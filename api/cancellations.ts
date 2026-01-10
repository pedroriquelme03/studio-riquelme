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
	if (!rawUrl) return null;
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
		if (!cli) return;
		try {
			await cli.query(`
				create table if not exists public.booking_cancellations (
					id uuid primary key default gen_random_uuid(),
					booking_id uuid not null references public.bookings(id) on delete cascade,
					cancelled_by text not null check (cancelled_by in ('client','admin')),
					created_at timestamptz default now()
				);
				create index if not exists idx_booking_cancellations_booking on public.booking_cancellations(booking_id);
				create index if not exists idx_booking_cancellations_by on public.booking_cancellations(cancelled_by);
				create index if not exists idx_booking_cancellations_created on public.booking_cancellations(created_at);
			`);
		} finally {
			await cli.end();
		}
	} catch {}
}

export default async function handler(req: any, res: any) {
	try {
		const supabase = getSupabaseServer();
		await ensureSchemaIfMissing();

		if (req.method !== 'GET') {
			res.setHeader('Allow', 'GET');
			return res.status(405).json({ ok: false, error: 'Método não permitido' });
		}

		const url = new URL(req?.url || '/', 'http://localhost');
		const professionalId = url.searchParams.get('professional_id') || undefined;
		const cancelledBy = url.searchParams.get('cancelled_by') || 'client';
		const from = url.searchParams.get('from') || undefined;
		const to = url.searchParams.get('to') || undefined;
		const limit = Number(url.searchParams.get('limit') || 50);
		const bookingIds = (url.searchParams.get('booking_ids') || '')
			.split(',')
			.map(s => s.trim())
			.filter(Boolean);

		let query = supabase
			.from('booking_cancellations')
			.select(`
        id, cancelled_by, created_at,
        bookings:booking_id (
          id, date, time, professional_id,
          clients:client_id ( id, name, phone, email )
        )
      `)
			.order('created_at', { ascending: false })
			.limit(Math.min(Math.max(limit, 1), 200));

		if (cancelledBy) query = query.eq('cancelled_by', cancelledBy);
		if (from) query = query.gte('created_at', from);
		if (to) query = query.lte('created_at', to);
		if (bookingIds.length) query = query.in('booking_id', bookingIds);

		const { data, error } = await query;
		if (error) return res.status(500).json({ ok: false, error: error.message });

		const rows = (data || []).filter((r: any) => {
			if (professionalId) {
				return String(r?.bookings?.professional_id || '') === String(professionalId);
			}
			return true;
		});

		return res.status(200).json({ ok: true, cancellations: rows });
	} catch (err: any) {
		return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
	}
}

