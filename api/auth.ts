// Tipos afrouxados para evitar dependência de @vercel/node em build local
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';

// Função para criar hash SHA-256 da senha
function hashPassword(password: string): string {
	return createHash('sha256').update(password).digest('hex');
}

// Função para verificar senha
function verifyPassword(password: string, hash: string): boolean {
	const passwordHash = hashPassword(password);
	return passwordHash === hash;
}

export default async function handler(req: any, res: any) {
	if (req.method === 'POST') {
		try {
			// Parse robusto do body (pode vir como string ou objeto)
			const raw = req.body ?? {};
			const parsed = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
			const { username, password } = (parsed || {}) as {
				username?: string;
				password?: string;
			};

			console.log('[AUTH] Login attempt:', { username: username || 'N/A', hasPassword: !!password });

			if (!username || !password) {
				console.log('[AUTH] Missing credentials:', { hasUsername: !!username, hasPassword: !!password });
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
				console.error('[AUTH] Supabase credentials missing:', {
					hasUrl: !!supabaseUrl,
					hasKey: !!supabaseKey,
					keyPrefix: supabaseKey ? supabaseKey.substring(0, 10) + '...' : 'N/A'
				});
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

			if (findError) {
				console.log('[AUTH] Error finding admin:', findError.message);
				return res.status(401).json({
					ok: false,
					error: 'Credenciais inválidas',
				});
			}

			if (!admin) {
				console.log('[AUTH] Admin not found or inactive:', username);
				return res.status(401).json({
					ok: false,
					error: 'Credenciais inválidas',
				});
			}

			console.log('[AUTH] Admin found:', { id: admin.id, username: admin.username, name: admin.name });

			// Verificar senha
			const passwordHash = hashPassword(password);
			const isPasswordValid = passwordHash === admin.password_hash;
			
			console.log('[AUTH] Password verification:', {
				passwordHash: passwordHash.substring(0, 20) + '...',
				storedHash: admin.password_hash.substring(0, 20) + '...',
				isValid: isPasswordValid
			});

			if (!isPasswordValid) {
				console.log('[AUTH] Invalid password for user:', username);
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

			console.log('[AUTH] Login successful for user:', username);

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
			console.error('[AUTH] Unexpected error:', err);
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

	// Endpoint para solicitar reset de senha
	if (req.method === 'PATCH' && req.body?.action === 'request-reset') {
		try {
			const { email } = (req.body || {}) as { email?: string };

			if (!email) {
				return res.status(400).json({
					ok: false,
					error: 'email é obrigatório',
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

			// Buscar admin por email
			const { data: admin, error: findError } = await supabase
				.from('admins')
				.select('id, username, name, email')
				.eq('email', email)
				.eq('is_active', true)
				.single();

			// Sempre retornar sucesso (não revelar se o email existe)
			if (findError || !admin) {
				return res.status(200).json({
					ok: true,
					message: 'Se o email existir, você receberá um link para redefinir sua senha.',
				});
			}

			// Gerar token único
			const token = randomBytes(32).toString('hex');
			const expiresAt = new Date();
			expiresAt.setHours(expiresAt.getHours() + 1); // Token válido por 1 hora

			// Salvar token no banco
			const { error: tokenError } = await supabase
				.from('password_reset_tokens')
				.insert({
					admin_id: admin.id,
					token,
					expires_at: expiresAt.toISOString(),
					used: false,
				});

			if (tokenError) {
				return res.status(500).json({
					ok: false,
					error: 'Erro ao gerar token de reset',
				});
			}

			// Construir link de reset
			let frontendUrl = process.env.FRONTEND_URL || '';
			
			// Se não tiver https://, adicionar
			if (frontendUrl && !frontendUrl.startsWith('http://') && !frontendUrl.startsWith('https://')) {
				frontendUrl = `https://${frontendUrl}`;
			}
			
			// Fallback para VERCEL_URL se FRONTEND_URL não estiver configurado
			if (!frontendUrl) {
				if (process.env.VERCEL_URL) {
					frontendUrl = `https://${process.env.VERCEL_URL}`;
				} else {
					frontendUrl = 'http://localhost:3000';
				}
			}
			
			const resetLink = `${frontendUrl}/admin/reset-password?token=${token}`;

			console.log('[AUTH] Enviando email de reset:', {
				email: admin.email,
				from: process.env.EMAIL_FROM,
				provider: process.env.EMAIL_PROVIDER,
				hasApiKey: !!process.env.RESEND_API_KEY,
				resetLink,
			});

			// Enviar email com o link de reset (import dinâmico para evitar erro de resolução em runtime do Vercel)
			let emailResult: { success: boolean; error?: string } = { success: false, error: 'Email sender not executed' };
			try {
				const mod = await import('./sendEmail').catch(async () => {
					// Tentativa com extensão .js (ambientes estritos ESM)
					return await import('./sendEmail.js');
				});
				const sendResetPasswordEmail = (mod as any).sendResetPasswordEmail as (email: string, link: string, name: string) => Promise<{ success: boolean; error?: string }>;
				emailResult = await sendResetPasswordEmail(
					admin.email!,
					resetLink,
					admin.name
				);
			} catch (e: any) {
				console.error('[AUTH] Falha ao carregar módulo sendEmail:', e?.message || e);
				// Não falhar o fluxo: retornaremos sucesso genérico e incluir o link para debug
				emailResult = { success: false, error: e?.message || 'Falha ao carregar módulo de email' };
			}

			console.log('[AUTH] Resultado do envio de email:', emailResult);

			// Se houver erro ao enviar email, logar mas não falhar a requisição
			// (por segurança, sempre retornar sucesso)
			if (!emailResult.success) {
				console.error('[AUTH] Erro ao enviar email de reset:', emailResult.error);
				// Em desenvolvimento ou se houver erro, retornar o link na resposta para debug
				return res.status(200).json({
					ok: true,
					message: 'Se o email existir, você receberá um link para redefinir sua senha.',
					error: emailResult.error, // Incluir erro para debug
					debug_link: resetLink, // Sempre incluir link para debug
				});
			}

			return res.status(200).json({
				ok: true,
				message: 'Se o email existir, você receberá um link para redefinir sua senha.',
			});
		} catch (err: any) {
			return res.status(500).json({
				ok: false,
				error: err?.message || 'Erro inesperado',
			});
		}
	}

	// Endpoint para redefinir senha com token
	if (req.method === 'PATCH' && req.body?.action === 'reset-password') {
		try {
			const { token, newPassword } = (req.body || {}) as {
				token?: string;
				newPassword?: string;
			};

			if (!token || !newPassword) {
				return res.status(400).json({
					ok: false,
					error: 'token e newPassword são obrigatórios',
				});
			}

			if (newPassword.length < 6) {
				return res.status(400).json({
					ok: false,
					error: 'A senha deve ter pelo menos 6 caracteres',
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

			// Buscar token válido
			const { data: resetToken, error: tokenError } = await supabase
				.from('password_reset_tokens')
				.select('id, admin_id, expires_at, used')
				.eq('token', token)
				.eq('used', false)
				.single();

			if (tokenError || !resetToken) {
				return res.status(400).json({
					ok: false,
					error: 'Token inválido ou expirado',
				});
			}

			// Verificar se o token expirou
			const now = new Date();
			const expiresAt = new Date(resetToken.expires_at);
			if (now > expiresAt) {
				return res.status(400).json({
					ok: false,
					error: 'Token expirado',
				});
			}

			// Criar hash da nova senha
			const passwordHash = hashPassword(newPassword);

			// Atualizar senha do admin
			const { error: updateError } = await supabase
				.from('admins')
				.update({ password_hash: passwordHash })
				.eq('id', resetToken.admin_id);

			if (updateError) {
				return res.status(500).json({
					ok: false,
					error: 'Erro ao atualizar senha',
				});
			}

			// Marcar token como usado
			await supabase
				.from('password_reset_tokens')
				.update({ used: true })
				.eq('id', resetToken.id);

			return res.status(200).json({
				ok: true,
				message: 'Senha redefinida com sucesso',
			});
		} catch (err: any) {
			return res.status(500).json({
				ok: false,
				error: err?.message || 'Erro inesperado',
			});
		}
	}

	res.setHeader('Allow', 'POST, PUT, PATCH');
	return res.status(405).json({ ok: false, error: 'Método não permitido' });
}

