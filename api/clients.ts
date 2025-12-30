// Tipos afrouxados para evitar dependência de @vercel/node em build local
// import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client } from 'pg';

async function getClient() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error('DATABASE_URL não configurada');
	}
	const client = new Client({
		connectionString: databaseUrl,
		ssl: { rejectUnauthorized: false },
	});
	await client.connect();
	return client;
}

export default async function handler(req: any, res: any) {
	try {
		if (req.method === 'GET') {
			const client = await getClient();
			try {
				const { rows } = await client.query(
					`select id, name, phone, email, notes, created_at, updated_at
           from public.clients
           order by created_at desc`
				);
				return res.status(200).json({ ok: true, clients: rows });
			} finally {
				await client.end();
			}
		}

		if (req.method === 'POST') {
			const { name, phone, email, notes } = (req.body || {}) as {
				name?: string;
				phone?: string;
				email?: string;
				notes?: string;
			};

			if (!name || !phone || !email) {
				return res.status(400).json({ ok: false, error: 'name, phone e email são obrigatórios' });
			}

			const client = await getClient();
			try {
				const { rows } = await client.query(
					`insert into public.clients (name, phone, email, notes)
           values ($1, $2, $3, $4)
           returning id, name, phone, email, notes, created_at, updated_at`,
					[name, phone, email, notes || null]
				);
				return res.status(201).json({ ok: true, client: rows[0] });
			} finally {
				await client.end();
			}
		}

		res.setHeader('Allow', 'GET, POST');
		return res.status(405).json({ ok: false, error: 'Método não permitido' });
	} catch (err: any) {
		return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
	}
}

