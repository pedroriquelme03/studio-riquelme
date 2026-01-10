import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getSupabaseServer() {
	const supabaseUrl =
		process.env.SUPABASE_URL ||
		process.env.VITE_SUPABASE_URL;
	const supabaseKey =
		process.env.SUPABASE_SERVICE_ROLE_KEY ||
		process.env.VITE_SUPABASE_ANON_KEY;
	if (!supabaseUrl || !supabaseKey) {
		throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados');
	}
	return createSupabaseClient(supabaseUrl, supabaseKey);
}

export default async function handler(req: any, res: any) {
	try {
		if (req.method !== 'GET') {
			res.setHeader('Allow', 'GET');
			return res.status(405).json({ ok: false, error: 'Método não permitido' });
		}

		const supabase = getSupabaseServer();
		const url = new URL(req?.url || '/', 'http://localhost');
		const sinceParam = url.searchParams.get('since') || '';
		let since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
		if (sinceParam) {
			const d = new Date(sinceParam);
			if (!isNaN(d.getTime())) since = d.toISOString();
		}

		// Buscar criações de bookings nas últimas 24h
		const bookingsQ = supabase
			.from('bookings')
			.select(`id, date, time, created_at, clients:client_id ( id, name, phone )`)
			.gte('created_at', since)
			.order('created_at', { ascending: false })
			.limit(50);

		// Buscar cancelamentos feitos por clientes nas últimas 24h
		const cancelsQ = supabase
			.from('booking_cancellations')
			.select(`id, created_at, cancelled_by, bookings:booking_id ( id, date, time, clients:client_id ( id, name, phone ) )`)
			.eq('cancelled_by', 'client')
			.gte('created_at', since)
			.order('created_at', { ascending: false })
			.limit(50);

		// Buscar solicitações de troca criadas nas últimas 24h
		const reschedQ = supabase
			.from('reschedule_requests')
			.select('id, requested_date, requested_time, status, created_at, booking_id')
			.gte('created_at', since)
			.order('created_at', { ascending: false })
			.limit(50);

		const [bookings, cancels, resched] = await Promise.all([bookingsQ, cancelsQ, reschedQ]);
		if (bookings.error) return res.status(500).json({ ok: false, error: bookings.error.message });
		if (cancels.error) return res.status(500).json({ ok: false, error: cancels.error.message });
		if (resched.error) return res.status(500).json({ ok: false, error: resched.error.message });

		const items: Array<any> = [];

		(bookings.data || []).forEach((b: any) => {
			items.push({
				type: 'booking',
				id: b.id,
				at: b.created_at,
				date: b.date,
				time: b.time,
				client_name: b.clients?.name || 'Cliente',
				client_phone: b.clients?.phone || '',
			});
		});
		(cancels.data || []).forEach((c: any) => {
			items.push({
				type: 'cancellation',
				id: c.id,
				at: c.created_at,
				date: c.bookings?.date,
				time: c.bookings?.time,
				client_name: c.bookings?.clients?.name || 'Cliente',
				client_phone: c.bookings?.clients?.phone || '',
			});
		});
		(resched.data || []).forEach((r: any) => {
			items.push({
				type: 'reschedule_request',
				id: r.id,
				at: r.created_at,
				requested_date: r.requested_date,
				requested_time: r.requested_time,
				status: r.status,
				booking_id: r.booking_id,
			});
		});

		// Ordenar por data desc e devolver
		items.sort((a, b) => String(b.at).localeCompare(String(a.at)));

		return res.status(200).json({ ok: true, items });
	} catch (err: any) {
		return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
	}
}

