import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client } from 'pg';

export default async function handler(req: VercelRequest, res: VercelResponse) {
	try {
		const databaseUrl = process.env.DATABASE_URL;
		if (!databaseUrl) {
			return res.status(500).json({ ok: false, error: 'DATABASE_URL não configurada' });
		}

		const client = new Client({
			connectionString: databaseUrl,
			ssl: { rejectUnauthorized: false }
		});

		await client.connect();
		const result = await client.query('select now() as now');
		await client.end();

		return res.status(200).json({ ok: true, now: result.rows[0]?.now });
	} catch (err: any) {
		return res.status(500).json({ ok: false, error: err?.message || 'Erro ao conectar' });
	}
}

