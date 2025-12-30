// Tipos afrouxados para evitar dependência de @vercel/node em build local
import { Client } from 'pg';

export default async function handler(req: any, res: any) {
	try {
		const databaseUrl = process.env.DATABASE_URL;
		if (!databaseUrl) {
			return res.status(500).json({ ok: false, error: 'DATABASE_URL não configurada' });
		}

		// Permitir desativar a verificação de certificado via flag (apenas para debug)
		if (process.env.DB_SSL_NO_VERIFY === '1') {
			// eslint-disable-next-line no-process-env
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
		}

		// Usar a connectionString para preservar todos os parâmetros (incluindo options=project=<ref>)
		// e ainda assim forçar ssl.rejectUnauthorized=false
		const client = new Client({
			connectionString: databaseUrl,
			ssl: { rejectUnauthorized: false },
		});

		await client.connect();
		const result = await client.query('select now() as now');
		await client.end();

		return res.status(200).json({ ok: true, now: result.rows[0]?.now });
	} catch (err: any) {
		return res.status(500).json({ ok: false, error: err?.message || 'Erro ao conectar' });
	}
}
 
