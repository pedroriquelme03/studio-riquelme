import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Client } from 'pg';

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

async function getPgClient() {
	const rawUrl =
		process.env.SUPABASE_DB_URL ||
		process.env.DATABASE_URL ||
		process.env.POSTGRES_URL ||
		'';
	if (!rawUrl) return null; // sem conexão direta, seguimos só com supabase-js

	// Forçar sslmode=no-verify para evitar problemas de cadeia
	let databaseUrl = rawUrl;
	if (databaseUrl.includes('sslmode=')) {
		databaseUrl = databaseUrl.replace(/([?&])sslmode=[^&]*/i, '$1sslmode=no-verify');
	} else {
		databaseUrl += (databaseUrl.includes('?') ? '&' : '?') + 'sslmode=no-verify';
	}

	const client = new Client({
		connectionString: databaseUrl,
		ssl: { rejectUnauthorized: false } as any,
	});
	await client.connect();
	return client;
}

async function ensureSchemaIfMissing() {
	try {
		const cli = await getPgClient();
		if (!cli) return; // sem PG URL, não há como criar automaticamente
		try {
			await cli.query(`
				create table if not exists public.reschedule_requests (
					id uuid primary key default gen_random_uuid(),
					booking_id uuid not null references public.bookings(id) on delete cascade,
					requested_date date not null,
					requested_time time not null,
					status text not null default 'pending' check (status in ('pending','approved','denied')),
					note text,
					response_note text,
					created_at timestamptz default now(),
					responded_at timestamptz
				);
				create index if not exists idx_reschedule_requests_booking on public.reschedule_requests(booking_id);
				create index if not exists idx_reschedule_requests_status on public.reschedule_requests(status);
			`);
		} finally {
			await cli.end();
		}
	} catch {
		// Silencioso: se falhar a criação automática, o próximo passo retornará erro claro
	}
}

async function refreshSchemaCacheIfNeeded(supabase: ReturnType<typeof getSupabaseServer>) {
	// Tentativa de sondar a tabela; se falhar por inexistência, tentar criar via PG e seguir
	const probe = await supabase
		.from('reschedule_requests')
		.select('id')
		.limit(1);
	if (probe.error && /relation|schema cache|not found/i.test(probe.error.message || '')) {
		await ensureSchemaIfMissing();
	}
}

export default async function handler(req: any, res: any) {
	try {
		const supabase = getSupabaseServer();
		await refreshSchemaCacheIfNeeded(supabase);

		if (req.method === 'GET') {
			const url = new URL(req?.url || '/', 'http://localhost');
			const bookingId = url.searchParams.get('booking_id') || undefined;
			const bookingIds = (url.searchParams.get('booking_ids') || '')
				.split(',')
				.map(s => s.trim())
				.filter(Boolean);
			const state = url.searchParams.get('state') || undefined; // 'pending' | 'approved' | 'denied'

			let query = supabase
				.from('reschedule_requests')
				.select('id, booking_id, requested_date, requested_time, status, note, created_at, responded_at')
				.order('created_at', { ascending: false });

			if (bookingId) query = query.eq('booking_id', bookingId);
			if (bookingIds.length) query = query.in('booking_id', bookingIds);
			if (state) query = query.eq('status', state);

			const { data, error } = await query;
			if (error) return res.status(500).json({ ok: false, error: error.message });
			return res.status(200).json({ ok: true, requests: data || [] });
		}

		if (req.method === 'POST') {
			const raw = req.body ?? {};
			const body = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
			const booking_id = String(body?.booking_id || '');
			const requested_date = String(body?.date || '');
			const requested_time = String(body?.time || '');
			const note = (body?.note || '') as string;

			if (!booking_id || !requested_date || !requested_time) {
				return res.status(400).json({ ok: false, error: 'booking_id, date e time são obrigatórios' });
			}

			const { error: insErr } = await supabase
				.from('reschedule_requests')
				.insert({
					booking_id,
					requested_date,
					requested_time: requested_time.length === 5 ? `${requested_time}:00` : requested_time,
					status: 'pending',
					note: note || null,
				});
			if (insErr) return res.status(500).json({ ok: false, error: insErr.message });
			return res.status(201).json({ ok: true });
		}

		if (req.method === 'PUT') {
			const raw = req.body ?? {};
			const body = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
			const id = String(body?.id || '');
			const action = String(body?.action || '').toLowerCase(); // 'approve' | 'deny'
			const response_note = (body?.note || '') as string;

			if (!id || !['approve', 'deny'].includes(action)) {
				return res.status(400).json({ ok: false, error: 'id e action (approve|deny) são obrigatórios' });
			}

			// Carregar a solicitação
			const { data: reqRow, error: rErr } = await supabase
				.from('reschedule_requests')
				.select('id, booking_id, requested_date, requested_time, status')
				.eq('id', id)
				.single();
			if (rErr || !reqRow) return res.status(404).json({ ok: false, error: 'Solicitação não encontrada' });
			if (reqRow.status !== 'pending') return res.status(400).json({ ok: false, error: 'Solicitação já processada' });

			if (action === 'approve') {
				// Atualiza o agendamento
				const { error: upErr } = await supabase
					.from('bookings')
					.update({ date: reqRow.requested_date, time: reqRow.requested_time, updated_at: new Date().toISOString() })
					.eq('id', reqRow.booking_id);
				if (upErr) return res.status(500).json({ ok: false, error: upErr.message });

				// Marca solicitação como aprovada
				const { error: rsErr } = await supabase
					.from('reschedule_requests')
					.update({ status: 'approved', responded_at: new Date().toISOString(), response_note })
					.eq('id', id);
				if (rsErr) return res.status(500).json({ ok: false, error: rsErr.message });

				return res.status(200).json({ ok: true });
			} else {
				// Nega solicitação
				const { error: rsErr } = await supabase
					.from('reschedule_requests')
					.update({ status: 'denied', responded_at: new Date().toISOString(), response_note })
					.eq('id', id);
				if (rsErr) return res.status(500).json({ ok: false, error: rsErr.message });
				return res.status(200).json({ ok: true });
			}
		}

		res.setHeader('Allow', 'GET, POST, PUT');
		return res.status(405).json({ ok: false, error: 'Método não permitido' });
	} catch (err: any) {
		return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
	}
}

