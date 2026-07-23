// Autenticação de administradores.
// - POST                    login (emite cookie de sessão assinado)
// - GET                     sessão atual; GET ?list=1 lista admins (exige admin)
// - DELETE                  logout
// - PUT                     cria admin (exige admin; liberado só no bootstrap)
// - PATCH request-reset     envia link de redefinição por email
// - PATCH reset-password    redefine a senha com o token
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import {
	ADMIN_COOKIE,
	appendCookie,
	buildClearCookie,
	buildSessionCookie,
	createSessionToken,
	getSession,
	hashPassword,
	requireAdmin,
	tokenHash,
	verifyPassword,
} from '../lib/session';

function getSupabaseServer() {
	const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
	const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
	if (!supabaseUrl || !supabaseKey) {
		throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados');
	}
	return createSupabaseClient(supabaseUrl, supabaseKey);
}

function parseBody(req: any): any {
	const raw = req?.body ?? {};
	if (typeof raw !== 'string') return raw || {};
	try {
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

export default async function handler(req: any, res: any) {
	// ── Sessão atual / listagem de admins ────────────────────────────────
	if (req.method === 'GET') {
		try {
			const urlObj = new URL(req?.url || '/', 'http://localhost');

			if (urlObj.searchParams.get('list') === '1') {
				if (!requireAdmin(req, res)) return;
				const supabase = getSupabaseServer();
				const { data, error } = await supabase
					.from('admins')
					.select('id, username, name, email, is_active, created_at, last_login')
					.order('created_at', { ascending: false });
				if (error) return res.status(500).json({ ok: false, error: error.message });
				return res.status(200).json({ ok: true, admins: data || [] });
			}

			const session = getSession(req, 'admin');
			if (!session || session.role !== 'admin') {
				return res.status(200).json({ ok: true, authenticated: false, admin: null });
			}
			return res.status(200).json({
				ok: true,
				authenticated: true,
				admin: { id: session.sub, username: session.username, name: session.name },
			});
		} catch (err: any) {
			return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
		}
	}

	// ── Logout ───────────────────────────────────────────────────────────
	if (req.method === 'DELETE') {
		appendCookie(res, buildClearCookie(ADMIN_COOKIE));
		return res.status(200).json({ ok: true });
	}

	// ── Login ────────────────────────────────────────────────────────────
	if (req.method === 'POST') {
		try {
			const { username, password } = parseBody(req) as {
				username?: string;
				password?: string;
			};

			if (!username || !password) {
				return res.status(400).json({ ok: false, error: 'username e password são obrigatórios' });
			}
			if (!process.env.SESSION_SECRET) {
				console.error('[AUTH] SESSION_SECRET ausente — login desabilitado.');
				return res.status(500).json({ ok: false, error: 'Servidor sem SESSION_SECRET configurada' });
			}

			const supabase = getSupabaseServer();

			const { data: admin, error: findError } = await supabase
				.from('admins')
				.select('id, username, password_hash, name, email, is_active')
				.eq('username', username)
				.eq('is_active', true)
				.maybeSingle();

			// Mensagem única para usuário inexistente e senha errada (evita enumeração).
			if (findError || !admin) {
				console.log('[AUTH] Login falhou (usuário não encontrado ou inativo)');
				return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
			}

			const { valid, needsRehash } = verifyPassword(password, admin.password_hash);
			if (!valid) {
				console.log('[AUTH] Login falhou (senha inválida)');
				return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
			}

			// Migra hashes legados (SHA-256 sem salt) para scrypt no primeiro login válido.
			const updates: Record<string, unknown> = { last_login: new Date().toISOString() };
			if (needsRehash) updates.password_hash = hashPassword(password);
			await supabase.from('admins').update(updates).eq('id', admin.id);

			const { token, maxAge } = createSessionToken({
				role: 'admin',
				sub: String(admin.id),
				username: admin.username,
				name: admin.name,
			});
			appendCookie(res, buildSessionCookie(ADMIN_COOKIE, token, maxAge));

			console.log('[AUTH] Login bem-sucedido:', username);
			return res.status(200).json({
				ok: true,
				admin: { id: admin.id, username: admin.username, name: admin.name, email: admin.email },
			});
		} catch (err: any) {
			console.error('[AUTH] Erro inesperado no login:', err?.message || err);
			return res.status(500).json({ ok: false, error: 'Erro inesperado' });
		}
	}

	// ── Criação de admin ─────────────────────────────────────────────────
	if (req.method === 'PUT') {
		try {
			const { username, password, name, email } = parseBody(req) as {
				username?: string;
				password?: string;
				name?: string;
				email?: string;
			};

			if (!username || !password || !name) {
				return res.status(400).json({ ok: false, error: 'username, password e name são obrigatórios' });
			}
			if (password.length < 8) {
				return res.status(400).json({ ok: false, error: 'A senha deve ter pelo menos 8 caracteres' });
			}

			const supabase = getSupabaseServer();

			// Bootstrap: se ainda não existe nenhum admin, a primeira criação é liberada.
			// A partir daí, só um admin autenticado pode criar outros.
			const { count } = await supabase
				.from('admins')
				.select('id', { count: 'exact', head: true });

			if ((count ?? 0) > 0) {
				if (!requireAdmin(req, res)) return;
			}

			const { data: existing } = await supabase
				.from('admins')
				.select('id')
				.eq('username', username)
				.maybeSingle();

			if (existing) {
				return res.status(400).json({ ok: false, error: 'Username já existe' });
			}

			const { data: newAdmin, error: insertError } = await supabase
				.from('admins')
				.insert({
					username,
					password_hash: hashPassword(password),
					name,
					email: email || null,
					is_active: true,
				})
				.select('id, username, name, email')
				.single();

			if (insertError) {
				return res.status(500).json({ ok: false, error: insertError.message });
			}

			return res.status(201).json({ ok: true, admin: newAdmin });
		} catch (err: any) {
			return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
		}
	}

	if (req.method === 'PATCH') {
		const body = parseBody(req);
		const action = String(body?.action || '');

		// ── Solicitar redefinição de senha ─────────────────────────────────
		if (action === 'request-reset') {
			try {
				const email = String(body?.email || '').trim();
				// Resposta genérica: nunca revela se o email existe.
				const genericResponse = {
					ok: true,
					message: 'Se o email existir, você receberá um link para redefinir sua senha.',
				};

				if (!email) {
					return res.status(400).json({ ok: false, error: 'email é obrigatório' });
				}

				const supabase = getSupabaseServer();

				const { data: admin } = await supabase
					.from('admins')
					.select('id, username, name, email')
					.eq('email', email)
					.eq('is_active', true)
					.maybeSingle();

				if (!admin) return res.status(200).json(genericResponse);

				// O token vai por email; no banco guardamos apenas o hash.
				const token = randomBytes(32).toString('hex');
				const expiresAt = new Date();
				expiresAt.setHours(expiresAt.getHours() + 1);

				const { error: tokenError } = await supabase.from('password_reset_tokens').insert({
					admin_id: admin.id,
					token: tokenHash(token),
					expires_at: expiresAt.toISOString(),
					used: false,
				});

				if (tokenError) {
					console.error('[AUTH] Erro ao gerar token de reset:', tokenError.message);
					return res.status(200).json(genericResponse);
				}

				let frontendUrl = process.env.FRONTEND_URL || '';
				if (frontendUrl && !/^https?:\/\//.test(frontendUrl)) {
					frontendUrl = `https://${frontendUrl}`;
				}
				if (!frontendUrl) {
					frontendUrl = process.env.VERCEL_URL
						? `https://${process.env.VERCEL_URL}`
						: 'http://localhost:3000';
				}
				const resetLink = `${frontendUrl}/admin/reset-password?token=${token}`;

				try {
					const mod = await import('../lib/sendEmail').catch(
						async () => await import('../lib/sendEmail.js'),
					);
					const sendResetPasswordEmail = (mod as any).sendResetPasswordEmail as (
						email: string,
						link: string,
						name: string,
					) => Promise<{ success: boolean; error?: string }>;
					const result = await sendResetPasswordEmail(admin.email!, resetLink, admin.name);
					if (!result.success) {
						// Nunca devolver o link na resposta: seria entregar o reset a quem pediu.
						console.error('[AUTH] Falha ao enviar email de reset:', result.error);
					}
				} catch (e: any) {
					console.error('[AUTH] Falha ao carregar módulo sendEmail:', e?.message || e);
				}

				return res.status(200).json(genericResponse);
			} catch (err: any) {
				console.error('[AUTH] Erro no request-reset:', err?.message || err);
				return res.status(500).json({ ok: false, error: 'Erro inesperado' });
			}
		}

		// ── Redefinir senha com token ──────────────────────────────────────
		if (action === 'reset-password') {
			try {
				const token = String(body?.token || '');
				const newPassword = String(body?.newPassword || '');

				if (!token || !newPassword) {
					return res.status(400).json({ ok: false, error: 'token e newPassword são obrigatórios' });
				}
				if (newPassword.length < 8) {
					return res.status(400).json({ ok: false, error: 'A senha deve ter pelo menos 8 caracteres' });
				}

				const supabase = getSupabaseServer();

				const { data: resetToken, error: tokenError } = await supabase
					.from('password_reset_tokens')
					.select('id, admin_id, expires_at, used')
					.eq('token', tokenHash(token))
					.eq('used', false)
					.maybeSingle();

				if (tokenError || !resetToken) {
					return res.status(400).json({ ok: false, error: 'Token inválido ou expirado' });
				}
				if (new Date() > new Date(resetToken.expires_at)) {
					return res.status(400).json({ ok: false, error: 'Token inválido ou expirado' });
				}

				const { error: updateError } = await supabase
					.from('admins')
					.update({ password_hash: hashPassword(newPassword) })
					.eq('id', resetToken.admin_id);

				if (updateError) {
					return res.status(500).json({ ok: false, error: 'Erro ao atualizar senha' });
				}

				// Queima este token e todos os outros pendentes do mesmo admin.
				await supabase
					.from('password_reset_tokens')
					.update({ used: true })
					.eq('admin_id', resetToken.admin_id)
					.eq('used', false);

				// Encerra sessões do navegador atual por precaução.
				appendCookie(res, buildClearCookie(ADMIN_COOKIE));

				return res.status(200).json({ ok: true, message: 'Senha redefinida com sucesso' });
			} catch (err: any) {
				return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
			}
		}

		return res.status(400).json({ ok: false, error: 'Ação inválida' });
	}

	res.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE');
	return res.status(405).json({ ok: false, error: 'Método não permitido' });
}
