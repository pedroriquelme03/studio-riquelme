// Tipos afrouxados para evitar dependência de @vercel/node em build local
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Usar crypto do Node.js (disponível no Vercel)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('crypto');

// Função para criar hash SHA-256 da senha
function hashPassword(password: string): string {
	return crypto.createHash('sha256').update(password).digest('hex');
}

// Função para verificar senha
function verifyPassword(password: string, hash: string): boolean {
	const passwordHash = hashPassword(password);
	return passwordHash === hash;
}

export default async function handler(req: any, res: any) {
	if (req.method === 'POST') {
		try {
			const { username, password } = (req.body || {}) as {
				username?: string;
				password?: string;
			};

			if (!username || !password) {
				return res.status(400).json({
					ok: false,
					error: 'username e password são obrigatórios',
				});
			}

			// Supabase server client (usa service role)
			const supabaseUrl =
				process.env.SUPABASE_URL ||
				process.env.VITE_SUPABASE_URL;
			const supabaseKey =
				process.env.SUPABASE_SERVICE_ROLE_KEY ||
				process.env.VITE_SUPABASE_ANON_KEY;

			if (!supabaseUrl || !supabaseKey) {
				return res.status(500).json({
					ok: false,
					error: 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados',
				});
			}

			const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

			// Buscar admin por username
			const { data: admin, error: findError } = await supabase
				.from('admins')
				.select('id, username, password_hash, name, email, is_active')
				.eq('username', username)
				.eq('is_active', true)
				.single();

			if (findError || !admin) {
				// Não revelar se o usuário existe ou não (segurança)
				return res.status(401).json({
					ok: false,
					error: 'Credenciais inválidas',
				});
			}

			// Verificar senha
			if (!verifyPassword(password, admin.password_hash)) {
				return res.status(401).json({
					ok: false,
					error: 'Credenciais inválidas',
				});
			}

			// Atualizar último login
			await supabase
				.from('admins')
				.update({ last_login: new Date().toISOString() })
				.eq('id', admin.id);

			// Retornar dados do admin (sem a senha)
			return res.status(200).json({
				ok: true,
				admin: {
					id: admin.id,
					username: admin.username,
					name: admin.name,
					email: admin.email,
				},
			});
		} catch (err: any) {
			return res.status(500).json({
				ok: false,
				error: err?.message || 'Erro inesperado',
			});
		}
	}

	// Endpoint para criar admin (apenas para setup inicial)
	if (req.method === 'PUT') {
		try {
			const { username, password, name, email } = (req.body || {}) as {
				username?: string;
				password?: string;
				name?: string;
				email?: string;
			};

			if (!username || !password || !name) {
				return res.status(400).json({
					ok: false,
					error: 'username, password e name são obrigatórios',
				});
			}

			const supabaseUrl =
				process.env.SUPABASE_URL ||
				process.env.VITE_SUPABASE_URL;
			const supabaseKey =
				process.env.SUPABASE_SERVICE_ROLE_KEY ||
				process.env.VITE_SUPABASE_ANON_KEY;

			if (!supabaseUrl || !supabaseKey) {
				return res.status(500).json({
					ok: false,
					error: 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados',
				});
			}

			const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

			// Verificar se username já existe
			const { data: existing } = await supabase
				.from('admins')
				.select('id')
				.eq('username', username)
				.single();

			if (existing) {
				return res.status(400).json({
					ok: false,
					error: 'Username já existe',
				});
			}

			// Criar hash da senha
			const passwordHash = hashPassword(password);

			// Inserir novo admin
			const { data: newAdmin, error: insertError } = await supabase
				.from('admins')
				.insert({
					username,
					password_hash: passwordHash,
					name,
					email: email || null,
					is_active: true,
				})
				.select('id, username, name, email')
				.single();

			if (insertError) {
				return res.status(500).json({
					ok: false,
					error: insertError.message,
				});
			}

			return res.status(201).json({
				ok: true,
				admin: newAdmin,
			});
		} catch (err: any) {
			return res.status(500).json({
				ok: false,
				error: err?.message || 'Erro inesperado',
			});
		}
	}

	res.setHeader('Allow', 'POST, PUT');
	return res.status(405).json({ ok: false, error: 'Método não permitido' });
}

