// Autenticação de clientes (WhatsApp e/ou e-mail + senha).
//
// Ações (POST):
//   register         cria conta (nome, WhatsApp, e-mail, senha) + sessão
//   login_password   login com WhatsApp OU e-mail + senha
//   set_password     troca de senha (exige sessão OU senha atual)
//   request_reset    envia link de redefinição por e-mail (Resend)
//   reset_password   confirma o token do e-mail e define a nova senha
//   logout           encerra a sessão
// GET: devolve a sessão atual.

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import {
	CLIENT_COOKIE,
	appendCookie,
	buildClearCookie,
	buildSessionCookie,
	createSessionToken,
	getSession,
	hashPassword,
	tokenHash,
	verifyPassword,
	requireClient,
} from './_lib/session.js';
import { hardenErrors } from './_lib/http.js';
import { RATE_RULES, enforceRateLimits, getClientIp, rateLimitReset } from './_lib/rate-limit.js';
import {
	ValidationError,
	validateLoginPassword,
	validateNewPassword,
	validatePersonName,
	validateRequiredEmail,
} from './_lib/validation.js';
import {
	getMyPlanResponse,
	subscribeToPlan,
	cancelClientSubscription,
	getPlanBenefitForService,
} from './_lib/client-subscriptions.js';

const RESET_TTL_HOURS = 1;
const RESET_RESEND_COOLDOWN_SECONDS = 60;

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

function normalizePhone(phone?: string): string {
	return (phone || '').replace(/\D/g, '');
}

function normalizeEmail(email?: string): string {
	return String(email || '').trim().toLowerCase();
}

/** Celular BR: DDD (2) + 9 + 8 dígitos. Aceita com ou sem DDI 55. */
function isValidPhone(digits: string): boolean {
	const local = digits.startsWith('55') && digits.length === 13 ? digits.slice(2) : digits;
	return local.length === 11 && /^[1-9]\d$/.test(local.slice(0, 2)) && local[2] === '9';
}

function isTempEmail(email: string): boolean {
	return !email || email.endsWith('@temp.local') || email.startsWith('whatsapp_');
}

function looksLikeEmail(value: string): boolean {
	return value.includes('@');
}

function issueClientSession(res: any, clientId: string, phone: string) {
	const { token, maxAge } = createSessionToken({ role: 'client', sub: clientId, phone });
	appendCookie(res, buildSessionCookie(CLIENT_COOKIE, token, maxAge));
}

function frontendBaseUrl(): string {
	let frontendUrl = process.env.FRONTEND_URL || '';
	if (frontendUrl && !/^https?:\/\//.test(frontendUrl)) {
		frontendUrl = `https://${frontendUrl}`;
	}
	if (!frontendUrl) {
		frontendUrl = process.env.VERCEL_URL
			? `https://${process.env.VERCEL_URL}`
			: 'http://localhost:5173';
	}
	return frontendUrl.replace(/\/$/, '');
}

async function findClientByEmail(supabase: any, email: string) {
	const { data } = await supabase
		.from('clients')
		.select('id, name, phone, email, password_hash')
		.eq('email', email)
		.maybeSingle();
	if (!data?.id || isTempEmail(String(data.email || ''))) return null;
	return data;
}

async function findClientByPhone(supabase: any, phone: string) {
	const { data } = await supabase
		.from('clients')
		.select('id, name, phone, email, password_hash')
		.eq('phone', phone)
		.maybeSingle();
	return data?.id ? data : null;
}

/** Resolve login por WhatsApp (só dígitos) ou e-mail. */
async function resolveLoginClient(supabase: any, identifierRaw: string) {
	const identifier = String(identifierRaw || '').trim();
	if (!identifier) return null;

	if (looksLikeEmail(identifier)) {
		const email = normalizeEmail(identifier);
		if (!email || isTempEmail(email)) return null;
		return findClientByEmail(supabase, email);
	}

	const phone = normalizePhone(identifier);
	if (!isValidPhone(phone)) return null;
	return findClientByPhone(supabase, phone);
}

export default async function handler(req: any, res: any) {
	hardenErrors(req, res);
	try {
		if (req.method === 'GET') {
			const url = new URL(req?.url || '/', 'http://localhost');
			const supabase = getSupabaseServer();

			if (url.searchParams.get('my_plan') === '1') {
				const session = getSession(req, 'client');
				if (!session || session.role !== 'client') {
					return res.status(401).json({ ok: false, error: 'Não autenticado' });
				}
				try {
					const payload = await getMyPlanResponse(supabase, String(session.sub));
					return res.status(200).json(payload);
				} catch (e: any) {
					return res.status(500).json({ ok: false, error: e?.message || 'Erro ao carregar plano' });
				}
			}

			const serviceId = Number(url.searchParams.get('service_id') || '0');
			if (url.searchParams.get('plan_benefit') === '1' && serviceId) {
				const session = getSession(req, 'client');
				if (!session || session.role !== 'client') {
					return res.status(200).json({ ok: true, available: false, requiresAuth: true });
				}
				try {
					const payload = await getPlanBenefitForService(supabase, String(session.sub), serviceId);
					return res.status(200).json(payload);
				} catch (e: any) {
					return res.status(500).json({ ok: false, error: e?.message || 'Erro ao verificar benefício' });
				}
			}

			const session = getSession(req, 'client');
			if (!session || session.role !== 'client') {
				return res.status(200).json({ ok: true, authenticated: false, phone: null });
			}
			return res.status(200).json({ ok: true, authenticated: true, phone: session.phone });
		}

		if (req.method !== 'POST') {
			res.setHeader('Allow', 'GET, POST');
			return res.status(405).json({ ok: false, error: 'Método não permitido' });
		}

		const body = parseBody(req);
		const action = String(body?.action || '').toLowerCase();

		const validActions = [
			'register',
			'login_password',
			'set_password',
			'request_reset',
			'reset_password',
			'logout',
			'subscribe_plan',
			'cancel_subscription',
		];
		if (!validActions.includes(action)) {
			return res.status(400).json({ ok: false, error: 'Ação inválida' });
		}

		if (action === 'logout') {
			appendCookie(res, buildClearCookie(CLIENT_COOKIE));
			return res.status(200).json({ ok: true });
		}

		if (action === 'subscribe_plan' || action === 'cancel_subscription') {
			if (!requireClient(req, res)) return;
			const session = getSession(req, 'client')!;
			const clientId = String(session.sub);
			const supabase = getSupabaseServer();

			if (action === 'subscribe_plan') {
				const planId = String(body?.plan_id || body?.planId || '');
				if (!planId) return res.status(400).json({ ok: false, error: 'plan_id é obrigatório' });
				try {
					const result = await subscribeToPlan(supabase, clientId, planId);
					return res.status(200).json(result);
				} catch (e: any) {
					return res.status(e?.status || 500).json({ ok: false, error: e?.message || 'Erro ao iniciar assinatura' });
				}
			}

			try {
				const result = await cancelClientSubscription(supabase, clientId);
				return res.status(200).json(result);
			} catch (e: any) {
				return res.status(e?.status || 500).json({ ok: false, error: e?.message || 'Erro ao cancelar assinatura' });
			}
		}

		if (!process.env.SESSION_SECRET) {
			console.error('[client-auth] SESSION_SECRET ausente.');
			return res.status(500).json({ ok: false, error: 'Servidor sem SESSION_SECRET configurada' });
		}

		const phone = normalizePhone(body?.phone);
		const name = String(body?.name || '').trim();
		const password = String(body?.password || '');
		const supabase = getSupabaseServer();
		const ip = getClientIp(req);

		// ── Registro ───────────────────────────────────────────────────────
		if (action === 'register') {
			if (!name) return res.status(400).json({ ok: false, error: 'name é obrigatório' });
			if (!isValidPhone(phone)) {
				return res.status(400).json({ ok: false, error: 'Informe um celular válido com DDD e o 9' });
			}
			const email = validateRequiredEmail(body?.email);
			validatePersonName(name);
			validateNewPassword(password);
			if (!(await enforceRateLimits(supabase, res, [[`register:ip:${ip}`, RATE_RULES.registerIp]]))) return;

			const { data: existingByPhone } = await supabase
				.from('clients')
				.select('id, password_hash, email')
				.eq('phone', phone)
				.maybeSingle();

			if (existingByPhone?.password_hash) {
				return res.status(409).json({
					ok: false,
					error: 'Já existe uma conta para este WhatsApp. Faça login ou use "Esqueci a senha".',
				});
			}

			const existingByEmail = await findClientByEmail(supabase, email);
			if (existingByEmail?.password_hash && String(existingByEmail.id) !== String(existingByPhone?.id || '')) {
				return res.status(409).json({
					ok: false,
					error: 'Já existe uma conta para este e-mail. Faça login ou use "Esqueci a senha".',
				});
			}

			let clientId: string;
			if (existingByPhone?.id) {
				clientId = String(existingByPhone.id);
				const { error: upErr } = await supabase
					.from('clients')
					.update({
						name,
						email,
						password_hash: hashPassword(password),
						updated_at: new Date().toISOString(),
					})
					.eq('id', clientId);
				if (upErr) {
					if (/unique|duplicate/i.test(upErr.message)) {
						return res.status(409).json({ ok: false, error: 'Este e-mail já está em uso.' });
					}
					return res.status(500).json({ ok: false, error: upErr.message });
				}
			} else {
				const { data: newClient, error: insErr } = await supabase
					.from('clients')
					.insert({ name, phone, email, password_hash: hashPassword(password) })
					.select('id')
					.single();
				if (insErr) {
					if (/unique|duplicate/i.test(insErr.message)) {
						return res.status(409).json({ ok: false, error: 'WhatsApp ou e-mail já cadastrado.' });
					}
					return res.status(500).json({ ok: false, error: insErr.message });
				}
				clientId = String(newClient.id);
			}

			const { data: touched } = await supabase
				.from('registered_clients')
				.update({
					client_id: clientId,
					name,
					email,
					updated_at: new Date().toISOString(),
				})
				.eq('phone', phone)
				.select('id');
			if (!touched?.length) {
				await supabase.from('registered_clients').insert({
					client_id: clientId,
					name,
					phone,
					email,
				});
			}

			issueClientSession(res, clientId, phone);
			return res.status(201).json({ ok: true, phone, email });
		}

		// ── Login com senha (WhatsApp ou e-mail) ───────────────────────────
		if (action === 'login_password') {
			const identifier = String(body?.identifier || body?.email || body?.phone || '').trim();
			if (!identifier || !password) {
				return res.status(400).json({ ok: false, error: 'Informe WhatsApp ou e-mail e a senha' });
			}

			try {
				validateLoginPassword(password);
			} catch {
				return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
			}

			const identityKey = looksLikeEmail(identifier)
				? `email:${normalizeEmail(identifier)}`
				: `phone:${normalizePhone(identifier)}`;
			const loginIpAccountKey = `login:client:ip-acct:${ip}:${identityKey}`;
			const loginAccountKey = `login:client:acct:${identityKey}`;
			const loginAllowed = await enforceRateLimits(supabase, res, [
				[loginIpAccountKey, RATE_RULES.loginIpAccount],
				[loginAccountKey, RATE_RULES.loginAccount],
				[`login:client:ip:${ip}`, RATE_RULES.loginIp],
			]);
			if (!loginAllowed) return;

			const client = await resolveLoginClient(supabase, identifier);
			const { valid, needsRehash } = verifyPassword(password, client?.password_hash);
			if (!client?.id || !valid) {
				return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
			}

			if (needsRehash) {
				await supabase
					.from('clients')
					.update({ password_hash: hashPassword(password) })
					.eq('id', client.id);
			}

			const clientPhone = normalizePhone(client.phone) || normalizePhone(identifier);
			await supabase
				.from('registered_clients')
				.update({ last_login: new Date().toISOString(), updated_at: new Date().toISOString() })
				.eq('phone', clientPhone);

			issueClientSession(res, String(client.id), clientPhone);
			await rateLimitReset(supabase, [loginIpAccountKey, loginAccountKey]);
			return res.status(200).json({
				ok: true,
				phone: clientPhone,
				email: isTempEmail(String(client.email || '')) ? null : client.email,
			});
		}

		// ── Troca de senha (sessão ativa OU senha atual) ────────────────────
		if (action === 'set_password') {
			const newPassword = String(body?.new_password || body?.password || '');
			const currentPassword = String(body?.current_password || '');
			validateNewPassword(newPassword);

			const session = getSession(req, 'client');
			let clientId: string | null = null;

			if (session && session.role === 'client') {
				clientId = session.sub;
			} else {
				const identifier = String(body?.identifier || body?.email || body?.phone || '').trim();
				if (!identifier || !currentPassword) {
					return res.status(401).json({
						ok: false,
						error: 'Faça login ou informe a senha atual para trocar a senha.',
					});
				}
				const identityKey = looksLikeEmail(identifier)
					? `email:${normalizeEmail(identifier)}`
					: `phone:${normalizePhone(identifier)}`;
				const loginAllowed = await enforceRateLimits(supabase, res, [
					[`login:client:ip-acct:${ip}:${identityKey}`, RATE_RULES.loginIpAccount],
					[`login:client:acct:${identityKey}`, RATE_RULES.loginAccount],
					[`login:client:ip:${ip}`, RATE_RULES.loginIp],
				]);
				if (!loginAllowed) return;

				const client = await resolveLoginClient(supabase, identifier);
				const { valid } = verifyPassword(currentPassword, client?.password_hash);
				if (!client?.id || !valid) {
					return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
				}
				clientId = String(client.id);
			}

			const { error: upErr } = await supabase
				.from('clients')
				.update({ password_hash: hashPassword(newPassword), updated_at: new Date().toISOString() })
				.eq('id', clientId);
			if (upErr) return res.status(500).json({ ok: false, error: upErr.message });

			return res.status(200).json({ ok: true });
		}

		// ── Solicitar redefinição por e-mail (Resend) ──────────────────────
		if (action === 'request_reset') {
			const generic = {
				ok: true,
				message: 'Se houver uma conta para este e-mail, você receberá um link para redefinir a senha.',
			};

			let email: string;
			try {
				email = validateRequiredEmail(body?.email);
			} catch {
				return res.status(400).json({ ok: false, error: 'Informe um e-mail válido' });
			}

			const resetAllowed = await enforceRateLimits(supabase, res, [
				[`otp-request:ip:${ip}`, RATE_RULES.otpRequestIp],
				[`otp-request:email:${email}`, RATE_RULES.otpRequestPhone],
			]);
			if (!resetAllowed) return;

			const client = await findClientByEmail(supabase, email);
			if (!client?.id || !client.password_hash) return res.status(200).json(generic);

			const clientPhone = normalizePhone(client.phone);
			if (!clientPhone) return res.status(200).json(generic);

			const { data: recent } = await supabase
				.from('client_password_resets')
				.select('created_at')
				.eq('client_id', client.id)
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle();
			if (recent?.created_at) {
				const elapsed = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
				if (elapsed < RESET_RESEND_COOLDOWN_SECONDS) return res.status(200).json(generic);
			}

			const token = randomBytes(32).toString('hex');
			const expiresAt = new Date(Date.now() + RESET_TTL_HOURS * 60 * 60 * 1000);

			await supabase
				.from('client_password_resets')
				.update({ used: true })
				.eq('client_id', client.id)
				.eq('used', false);

			const { error: insErr } = await supabase.from('client_password_resets').insert({
				client_id: client.id,
				phone: clientPhone,
				code_hash: tokenHash(token),
				expires_at: expiresAt.toISOString(),
				attempts: 0,
				used: false,
			});
			if (insErr) {
				console.error('[client-auth] Erro ao gravar token de reset:', insErr.message);
				return res.status(200).json(generic);
			}

			const resetLink = `${frontendBaseUrl()}/login-cliente?token=${token}`;
			try {
				const mod = await import('./_lib/sendEmail.js');
				const sendResetPasswordEmail = (mod as any).sendResetPasswordEmail as (
					to: string,
					link: string,
					name: string,
				) => Promise<{ success: boolean; error?: string }>;
				const result = await sendResetPasswordEmail(
					String(client.email || email),
					resetLink,
					client.name || 'Cliente',
				);
				if (!result.success) {
					console.error('[client-auth] Falha ao enviar e-mail de reset:', result.error);
				}
			} catch (e: any) {
				console.error('[client-auth] Falha ao carregar sendEmail:', e?.message || e);
			}

			return res.status(200).json(generic);
		}

		// ── Confirmar token do e-mail e trocar a senha ─────────────────────
		if (action === 'reset_password') {
			const token = String(body?.token || '');
			const newPassword = String(body?.new_password || body?.newPassword || body?.password || '');

			if (!token || token.length > 200) {
				return res.status(400).json({ ok: false, error: 'Token inválido ou expirado' });
			}
			validateNewPassword(newPassword);
			if (!(await enforceRateLimits(supabase, res, [[`otp-verify:ip:${ip}`, RATE_RULES.otpVerifyIp]]))) return;

			const { data: reset } = await supabase
				.from('client_password_resets')
				.select('id, client_id, phone, code_hash, expires_at, attempts, used')
				.eq('code_hash', tokenHash(token))
				.eq('used', false)
				.maybeSingle();

			const invalid = { ok: false, error: 'Link inválido ou expirado' };
			if (!reset?.id) return res.status(400).json(invalid);

			if (new Date() > new Date(reset.expires_at) || reset.attempts >= 5) {
				await supabase.from('client_password_resets').update({ used: true }).eq('id', reset.id);
				return res.status(400).json(invalid);
			}

			const { data: client } = await supabase
				.from('clients')
				.select('id, phone')
				.eq('id', reset.client_id)
				.maybeSingle();
			if (!client?.id) return res.status(400).json(invalid);

			const { error: upErr } = await supabase
				.from('clients')
				.update({ password_hash: hashPassword(newPassword), updated_at: new Date().toISOString() })
				.eq('id', client.id);
			if (upErr) return res.status(500).json({ ok: false, error: upErr.message });

			await supabase.from('client_password_resets').update({ used: true }).eq('id', reset.id);

			const sessionPhone = normalizePhone(client.phone) || normalizePhone(reset.phone);
			issueClientSession(res, String(client.id), sessionPhone);
			return res.status(200).json({ ok: true, phone: sessionPhone });
		}

		return res.status(400).json({ ok: false, error: 'Ação inválida' });
	} catch (err: any) {
		if (err instanceof ValidationError) {
			return res.status(400).json({ ok: false, error: err.message });
		}
		console.error('[client-auth] Erro inesperado:', err?.message || err);
		return res.status(500).json({ ok: false, error: 'Erro inesperado' });
	}
}
