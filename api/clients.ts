import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireAdmin } from './_lib/session.js';
import { hardenErrors } from './_lib/http.js';

function getSupabaseServer() {
	const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
	const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
	if (!supabaseUrl || !supabaseKey) {
		throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados');
	}
	return createSupabaseClient(supabaseUrl, supabaseKey);
}

function normalizePhone(raw: unknown): string {
	return String(raw || '').replace(/\D/g, '');
}

function mapBookingRow(b: any) {
	const services = (b.booking_services || [])
		.map((bs: any) => ({
			id: bs?.services?.id,
			name: bs?.services?.name,
			price: bs?.unit_price != null ? Number(bs.unit_price) : Number(bs?.services?.price || 0),
			duration_minutes: Number(bs?.services?.duration_minutes || 0),
			quantity: Number(bs?.quantity ?? 1),
			variant_label: bs?.variant_label || null,
		}))
		.filter((s: any) => s.id != null);

	const total_price = services.reduce(
		(sum: number, s: any) => sum + Number(s.price || 0) * Number(s.quantity || 1),
		0,
	);

	return {
		booking_id: b.id,
		date: b.date,
		time: b.time,
		professional_id: b.professional_id,
		professional_name: b.professionals?.name || null,
		total_price: total_price.toFixed(2),
		services,
		is_cancelled: Array.isArray(b.booking_cancellations) && b.booking_cancellations.length > 0,
		created_at: b.created_at || null,
	};
}

export default async function handler(req: any, res: any) {
	hardenErrors(req, res);
	try {
		if (!requireAdmin(req, res)) return;

		const supabase = getSupabaseServer();

		if (req.method === 'GET') {
			const urlObj = new URL(req?.url || '/', 'http://localhost');
			const clientId = urlObj.searchParams.get('client_id') || urlObj.searchParams.get('id') || '';
			const wantsHistory = urlObj.searchParams.get('history') === '1';
			const search = String(urlObj.searchParams.get('q') || '').trim().toLowerCase();

			if (wantsHistory) {
				if (!clientId) {
					return res.status(400).json({ ok: false, error: 'client_id é obrigatório' });
				}

				const [{ data: client, error: clientErr }, { data: bookings, error: bookErr }] = await Promise.all([
					supabase
						.from('clients')
						.select('id, name, phone, email, notes, created_at, updated_at')
						.eq('id', clientId)
						.maybeSingle(),
					supabase
						.from('bookings')
						.select(`
							id,
							date,
							time,
							professional_id,
							created_at,
							professionals:professional_id ( id, name ),
							booking_services (
								quantity,
								unit_price,
								variant_label,
								services:service_id ( id, name, price, duration_minutes )
							),
							booking_cancellations ( id )
						`)
						.eq('client_id', clientId)
						.order('date', { ascending: false })
						.order('time', { ascending: false }),
				]);

				if (clientErr) return res.status(500).json({ ok: false, error: clientErr.message });
				if (!client) return res.status(404).json({ ok: false, error: 'Cliente não encontrado' });
				if (bookErr) return res.status(500).json({ ok: false, error: bookErr.message });

				return res.status(200).json({
					ok: true,
					client,
					bookings: (bookings || []).map(mapBookingRow),
				});
			}

			let query = supabase
				.from('clients')
				.select('id, name, phone, email, notes, created_at, updated_at')
				.order('name', { ascending: true });

			const { data, error } = await query;
			if (error) return res.status(500).json({ ok: false, error: error.message });

			let clients = data || [];
			if (search) {
				const digits = search.replace(/\D/g, '');
				clients = clients.filter((c: any) => {
					const hay = `${c.name || ''} ${c.email || ''} ${c.phone || ''}`.toLowerCase();
					if (hay.includes(search)) return true;
					if (digits && String(c.phone || '').replace(/\D/g, '').includes(digits)) return true;
					return false;
				});
			}

			return res.status(200).json({ ok: true, clients });
		}

		if (req.method === 'POST') {
			const raw = req.body ?? {};
			const body = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
			const name = String(body?.name || '').trim();
			const phone = normalizePhone(body?.phone);
			const email = String(body?.email || '').trim() || null;
			const notes = String(body?.notes || '').trim() || null;

			if (!name || phone.length < 10) {
				return res.status(400).json({ ok: false, error: 'name e phone válidos são obrigatórios' });
			}

			const { data, error } = await supabase
				.from('clients')
				.insert({ name, phone, email, notes })
				.select('id, name, phone, email, notes, created_at, updated_at')
				.single();

			if (error) return res.status(500).json({ ok: false, error: error.message });
			return res.status(201).json({ ok: true, client: data });
		}

		res.setHeader('Allow', 'GET, POST');
		return res.status(405).json({ ok: false, error: 'Método não permitido' });
	} catch (err: any) {
		return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
	}
}
