// API para configurar horários de funcionamento por dia da semana
// e gerenciar horários manuais (extras/ajustes).
// - GET: retorna business_hours e manual_slots
// - PUT: atualiza business_hours (array de 7 dias)
// - POST: cria manual slot { date, time, professional_id?, note? }
// - DELETE: remove manual slot { id }

import { Client } from 'pg';

async function getClient() {
	const rawUrl =
		process.env.SUPABASE_DB_URL ||
		process.env.DATABASE_URL ||
		process.env.POSTGRES_URL ||
		'';
	if (!rawUrl) throw new Error('DATABASE_URL/SUPABASE_DB_URL não configurada');

	// Ajustar sslmode
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

async function ensureSchema(cli: Client) {
	await cli.query(`
		create table if not exists public.business_hours (
			id uuid primary key default gen_random_uuid(),
			weekday smallint not null check (weekday between 0 and 6),
			enabled boolean not null default true,
			open_time time not null default '09:00',
			close_time time not null default '20:00',
			created_at timestamptz default now(),
			updated_at timestamptz default now(),
			unique (weekday)
		);
		create table if not exists public.manual_slots (
			id uuid primary key default gen_random_uuid(),
			date date not null,
			time time not null,
			professional_id uuid null,
			note text,
			available boolean not null default true,
			created_at timestamptz default now()
		);
	`);
	// Seed padrão se vazio
	const r = await cli.query(`select count(*)::int as c from public.business_hours`);
	const count = r.rows?.[0]?.c ?? 0;
	if (count === 0) {
		// 0=domingo ... 6=sábado
		const defaults = [
			{ weekday: 0, enabled: false, open_time: '09:00', close_time: '20:00' },
			{ weekday: 1, enabled: true, open_time: '09:00', close_time: '20:00' },
			{ weekday: 2, enabled: true, open_time: '09:00', close_time: '20:00' },
			{ weekday: 3, enabled: true, open_time: '09:00', close_time: '20:00' },
			{ weekday: 4, enabled: true, open_time: '09:00', close_time: '20:00' },
			{ weekday: 5, enabled: true, open_time: '09:00', close_time: '20:00' },
			{ weekday: 6, enabled: true, open_time: '09:00', close_time: '16:00' },
		];
		for (const d of defaults) {
			await cli.query(
				`insert into public.business_hours (weekday, enabled, open_time, close_time) values ($1,$2,$3,$4)`,
				[d.weekday, d.enabled, d.open_time, d.close_time]
			);
		}
	}
}

export default async function handler(req: any, res: any) {
	try {
		const cli = await getClient();
		try {
			await ensureSchema(cli);

			if (req.method === 'GET') {
				const [hours, slots] = await Promise.all([
					cli.query(`select id, weekday, enabled, open_time, close_time from public.business_hours order by weekday asc`),
					cli.query(`select id, date, time, professional_id, note, available, created_at from public.manual_slots order by date asc, time asc limit 500`),
				]);
				return res.status(200).json({ ok: true, business_hours: hours.rows, manual_slots: slots.rows });
			}

			if (req.method === 'PUT') {
				const raw = req.body ?? {};
				const body = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
				const hours = Array.isArray(body?.business_hours) ? body.business_hours : [];
				if (hours.length !== 7) {
					return res.status(400).json({ ok: false, error: 'business_hours deve conter 7 itens (0=domingo ... 6=sábado)' });
				}
				for (const h of hours) {
					const weekday = Number(h?.weekday);
					const enabled = Boolean(h?.enabled);
					const open_time = String(h?.open_time || '09:00');
					const close_time = String(h?.close_time || '20:00');
					if (!(weekday >= 0 && weekday <= 6)) {
						return res.status(400).json({ ok: false, error: `weekday inválido: ${weekday}` });
					}
					await cli.query(
						`insert into public.business_hours (weekday, enabled, open_time, close_time)
             values ($1,$2,$3,$4)
             on conflict (weekday) do update set enabled=excluded.enabled, open_time=excluded.open_time, close_time=excluded.close_time, updated_at=now()`,
						[weekday, enabled, open_time, close_time]
					);
				}
				return res.status(200).json({ ok: true });
			}

			if (req.method === 'POST') {
				const raw = req.body ?? {};
				const body = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
				const date = String(body?.date || '');
				const time = String(body?.time || '');
				const professional_id = body?.professional_id || null;
				const note = (body?.note || '') as string;
				if (!date || !time) {
					return res.status(400).json({ ok: false, error: 'date e time são obrigatórios' });
				}
				const r = await cli.query(
					`insert into public.manual_slots (date, time, professional_id, note, available) values ($1,$2,$3,$4,true) returning id`,
					[date, time, professional_id, note || null]
				);
				return res.status(201).json({ ok: true, id: r.rows?.[0]?.id });
			}

			if (req.method === 'DELETE') {
				const raw = req.body ?? {};
				const body = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
				const id = String(body?.id || '');
				if (!id) return res.status(400).json({ ok: false, error: 'id é obrigatório' });
				await cli.query(`delete from public.manual_slots where id = $1`, [id]);
				return res.status(200).json({ ok: true });
			}

			res.setHeader('Allow', 'GET, PUT, POST, DELETE');
			return res.status(405).json({ ok: false, error: 'Método não permitido' });
		} finally {
			await cli.end();
		}
	} catch (err: any) {
		return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
	}
}

