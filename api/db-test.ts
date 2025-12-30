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

		// Parse da URL para forçar 'options=project=<ref>' no objeto de conexão,
		// pois alguns ambientes não propagam corretamente a querystring para o PG.
		let host = '';
		let port = 6543;
		let user = 'postgres';
		let password = '';
		let database = 'postgres';
		let projectRef = '';
		try {
			const url = new URL(databaseUrl);
			host = url.hostname;
			port = parseInt(url.port || '6543', 10);
			user = decodeURIComponent(url.username || 'postgres');
			password = decodeURIComponent(url.password || '');
			database = decodeURIComponent(url.pathname.replace(/^\//, '') || 'postgres');
			// tentar extrair project do querystring
			const qs = new URLSearchParams(url.search);
			const optionsParam = qs.get('options') || '';
			const m = /(?:^|,)project=([a-z0-9]+)(?:,|$)/.exec(optionsParam);
			if (m && m[1]) {
				projectRef = m[1];
			}
			// fallback: extrair do SUPABASE_URL
			if (!projectRef && process.env.SUPABASE_URL) {
				const u = new URL(process.env.SUPABASE_URL);
				projectRef = (u.hostname.split('.')[0] || '').trim();
			}
		} catch {
			// Se parsing falhar, seguimos com connectionString direto
		}

		const client = projectRef
			? new Client({
					host,
					port,
					user,
					password,
					database,
					ssl: { rejectUnauthorized: false },
					options: `project=${projectRef}`,
			  })
			: new Client({
					connectionString: databaseUrl,
					ssl: { rejectUnauthorized: false },
			  });

		await client.connect();
		const result = await client.query('select now() as now');
		await client.end();

		return res.status(200).json({ ok: true, now: result.rows[0]?.now });
	} catch (err: any) {
		// retornar algumas flags de debug sem vazar segredos
		const dbg: any = {};
		try {
			const url = new URL(process.env.DATABASE_URL || '');
			dbg.host = url.hostname;
			dbg.port = url.port;
			dbg.hasPooler = (url.hostname || '').includes('pooler.supabase.com');
			dbg.hasOptionsProject = (url.search || '').includes('options=project');
		} catch {}
		return res.status(500).json({ ok: false, error: err?.message || 'Erro ao conectar', debug: dbg });
	}
}
 
