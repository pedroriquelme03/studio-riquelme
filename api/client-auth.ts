// Autenticação simples de clientes via WhatsApp (telefone)
// - Cria automaticamente a tabela registered_clients se não existir
// - Registro: action = 'register' (POST), com name, phone, email (opcional)
// - Login: action = 'login' (POST), com phone

import { Client } from 'pg';

async function getClient() {
	const rawUrl =
		process.env.SUPABASE_DB_URL ||
		process.env.DATABASE_URL ||
		process.env.POSTGRES_URL ||
		'';

	if (!rawUrl) {
		throw new Error('DATABASE_URL/SUPABASE_DB_URL não configurada');
	}

	// Log seguro do host para facilitar debug no deploy (sem credenciais)
	try {
		const u = new URL(rawUrl);
		console.log('[client-auth] Conectando ao banco em host:', u.hostname);
	} catch {
		console.warn('[client-auth] DATABASE_URL inválida (não é uma URL). Verifique o valor configurado.');
	}

	// Forçar sslmode=no-verify para evitar erro de cadeia self-signed em provedores gerenciados
	let databaseUrl = rawUrl;
	if (databaseUrl.includes('sslmode=')) {
		databaseUrl = databaseUrl.replace(/([?&])sslmode=[^&]*/i, '$1sslmode=no-verify');
	} else {
		databaseUrl += (databaseUrl.includes('?') ? '&' : '?') + 'sslmode=no-verify';
	}

	// Usar SSL compatível com provedores gerenciados (Supabase/Neon/etc)
	// Evitar mexer no NODE_TLS_REJECT_UNAUTHORIZED global
	const client = new Client({
		connectionString: databaseUrl,
		ssl: { rejectUnauthorized: false } as any,
	});

	try {
		await client.connect();
		return client;
	} catch (e: any) {
		const msg = e?.message || String(e);
		// Normalizar mensagens comuns de configuração incorreta
		if (/tenant|user not found/i.test(msg)) {
			throw new Error('Falha ao conectar no banco: verifique a DATABASE_URL (tenant/usuário não encontrado). Use a string de conexão do seu banco (ex.: Supabase)');
		}
		throw new Error(`Falha ao conectar no banco: ${msg}`);
	}
}

function normalizePhone(phone?: string): string {
	const digits = (phone || '').replace(/\D/g, '');
	// mantém DDI/DDD/numero como informado, apenas números
	return digits;
}

async function ensureSchema(cli: Client) {
	// Criar tabela registered_clients se não existir
	await cli.query(`
		create table if not exists public.registered_clients (
			id uuid primary key default gen_random_uuid(),
			client_id uuid null references public.clients(id) on delete set null,
			name text not null,
			phone text not null unique,
			email text,
			created_at timestamptz default now(),
			updated_at timestamptz default now(),
			last_login timestamptz
		);
		create index if not exists idx_registered_clients_phone on public.registered_clients(phone);
	`);
}

export default async function handler(req: any, res: any) {
	try {
		if (req.method !== 'POST') {
			res.setHeader('Allow', 'POST');
			return res.status(405).json({ ok: false, error: 'Método não permitido' });
		}

		const raw = req.body ?? {};
		const body = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
		const action = String(body?.action || '').toLowerCase();

		if (!['register', 'login'].includes(action)) {
			return res.status(400).json({ ok: false, error: 'action deve ser "register" ou "login"' });
		}

		const phone = normalizePhone(body?.phone);
		const name = (body?.name || '').toString().trim();
		const email = (body?.email || '').toString().trim() || null;

		if (!phone) {
			return res.status(400).json({ ok: false, error: 'phone é obrigatório' });
		}

		const cli = await getClient();
		try {
			await ensureSchema(cli);

			if (action === 'register') {
				if (!name) {
					return res.status(400).json({ ok: false, error: 'name é obrigatório para register' });
				}

				// Encontrar client_id existente por phone na tabela clients
				const existingClient = await cli.query(
					`select id from public.clients where regexp_replace(phone, '\\D', '', 'g') = $1 limit 1`,
					[phone]
				);
				const clientId = existingClient.rows?.[0]?.id || null;

				// Upsert em registered_clients por phone
				await cli.query(
					`insert into public.registered_clients (client_id, name, phone, email)
					 values ($1, $2, $3, $4)
					 on conflict (phone) do update
					 set name = excluded.name,
					     email = coalesce(excluded.email, public.registered_clients.email),
					     client_id = coalesce(public.registered_clients.client_id, excluded.client_id),
					     updated_at = now()`,
					[clientId, name, phone, email]
				);

				// Atualiza email na clients se existir e foi informado agora
				if (clientId && email) {
					await cli.query(
						`update public.clients set email = $1, updated_at = now() where id = $2`,
						[email, clientId]
					);
				}

				return res.status(201).json({ ok: true, phone });
			}

			if (action === 'login') {
				// Verificar se telefone existe na registered_clients; se não, tentar clients como fallback
				const r1 = await cli.query(
					`select id, name, phone, email from public.registered_clients where phone = $1 limit 1`,
					[phone]
				);
				if (r1.rowCount === 0) {
					const r2 = await cli.query(
						`select id, name, phone, email from public.clients where regexp_replace(phone, '\\D', '', 'g') = $1 limit 1`,
						[phone]
					);
					if (r2.rowCount === 0) {
						return res.status(404).json({ ok: false, error: 'Telefone não encontrado' });
					}
				} else {
					await cli.query(`update public.registered_clients set last_login = now(), updated_at = now() where phone = $1`, [phone]);
				}
				return res.status(200).json({ ok: true, phone });
			}

			return res.status(400).json({ ok: false, error: 'Ação inválida' });
		} finally {
			await cli.end();
		}
	} catch (err: any) {
		return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
	}
}


