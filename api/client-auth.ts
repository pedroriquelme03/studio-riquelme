// Autenticação de clientes (identificados pelo WhatsApp).
//
// Ações (POST):
//   register        cria conta + senha, emite sessão
//   login_password  login com telefone + senha, emite sessão
//   set_password    troca de senha (exige sessão OU senha atual)
//   request_reset   envia código de 6 dígitos por WhatsApp
//   reset_with_code confirma o código e define a nova senha
//   logout          encerra a sessão
// GET: devolve a sessão atual.
//
// A ação `login` (só telefone, sem senha) foi removida: permitia entrar em
// qualquer conta sabendo apenas o número.

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { randomInt } from 'node:crypto';
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
} from './_lib/session.js';

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

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

/** Celular BR: DDD (2) + 9 + 8 dígitos. Aceita com ou sem DDI 55. */
function isValidPhone(digits: string): boolean {
	const local = digits.startsWith('55') && digits.length === 13 ? digits.slice(2) : digits;
	return local.length === 11 && /^[1-9]\d$/.test(local.slice(0, 2)) && local[2] === '9';
}

function issueClientSession(res: any, clientId: string, phone: string) {
	const { token, maxAge } = createSessionToken({ role: 'client', sub: clientId, phone });
	appendCookie(res, buildSessionCookie(CLIENT_COOKIE, token, maxAge));
}

/** Envia o código pela Edge Function de WhatsApp já existente. */
async function sendOtpViaWhatsApp(name: string, phone: string, code: string): Promise<boolean> {
	const template = (process.env.WHATSAPP_CLIENT_OTP_TEMPLATE || '').trim();
	if (!template) {
		console.error('[client-auth] WHATSAPP_CLIENT_OTP_TEMPLATE não configurado — código não enviado.');
		return false;
	}

	const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
	if (!supabaseUrl || !serviceKey) return false;

	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');

	try {
		const response = await fetch(
			`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/send-whatsapp-confirmation`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${serviceKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					nome: name,
					telefone: phone,
					data: `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`,
					hora: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
					template_name: template,
					// {{1}} nome, {{2}} código, {{3}} validade em minutos
					template_params: [name, code, String(OTP_TTL_MINUTES)],
				}),
			},
		);
		if (!response.ok) {
			console.error('[client-auth] Falha ao enviar OTP:', response.status, await response.text().catch(() => ''));
			return false;
		}
		return true;
	} catch (err: any) {
		console.error('[client-auth] Erro ao enviar OTP:', err?.message || err);
		return false;
	}
}

export default async function handler(req: any, res: any) {
	try {
		// ── Sessão atual ───────────────────────────────────────────────────
		if (req.method === 'GET') {
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
			'reset_with_code',
			'logout',
		];
		if (!validActions.includes(action)) {
			return res.status(400).json({ ok: false, error: 'Ação inválida' });
		}

		if (action === 'logout') {
			appendCookie(res, buildClearCookie(CLIENT_COOKIE));
			return res.status(200).json({ ok: true });
		}

		if (!process.env.SESSION_SECRET) {
			console.error('[client-auth] SESSION_SECRET ausente.');
			return res.status(500).json({ ok: false, error: 'Servidor sem SESSION_SECRET configurada' });
		}

		const phone = normalizePhone(body?.phone);
		const name = String(body?.name || '').trim();
		const password = String(body?.password || '');
		const supabase = getSupabaseServer();

		// ── Registro ───────────────────────────────────────────────────────
		if (action === 'register') {
			if (!name) return res.status(400).json({ ok: false, error: 'name é obrigatório' });
			if (!isValidPhone(phone)) {
				return res.status(400).json({ ok: false, error: 'Informe um celular válido com DDD e o 9' });
			}
			if (password.length < 8) {
				return res.status(400).json({ ok: false, error: 'A senha deve ter pelo menos 8 caracteres' });
			}

			const { data: existingClient } = await supabase
				.from('clients')
				.select('id, password_hash')
				.eq('phone', phone)
				.maybeSingle();

			// Já existe conta com senha: registrar de novo seria tomada de conta.
			if (existingClient?.password_hash) {
				return res.status(409).json({
					ok: false,
					error: 'Já existe uma conta para este WhatsApp. Faça login ou use "Esqueci a senha".',
				});
			}

			let clientId: string;
			if (existingClient?.id) {
				// Cliente criado pelo fluxo de agendamento, ainda sem login. Assume a conta.
				clientId = String(existingClient.id);
				const { error: upErr } = await supabase
					.from('clients')
					.update({
						name,
						password_hash: hashPassword(password),
						updated_at: new Date().toISOString(),
					})
					.eq('id', clientId);
				if (upErr) return res.status(500).json({ ok: false, error: upErr.message });
			} else {
				const { data: newClient, error: insErr } = await supabase
					.from('clients')
					.insert({ name, phone, password_hash: hashPassword(password) })
					.select('id')
					.single();
				if (insErr) return res.status(500).json({ ok: false, error: insErr.message });
				clientId = String(newClient.id);
			}

			// Update-e-senão-insert em vez de upsert: não depende do Postgres
			// conseguir inferir um índice único a partir de `phone` (é daí que vem
			// o erro 42P10 visto no Controle de Horários).
			const { data: touched } = await supabase
				.from('registered_clients')
				.update({ client_id: clientId, name, updated_at: new Date().toISOString() })
				.eq('phone', phone)
				.select('id');
			if (!touched?.length) {
				await supabase.from('registered_clients').insert({ client_id: clientId, name, phone });
			}

			issueClientSession(res, clientId, phone);
			return res.status(201).json({ ok: true, phone });
		}

		// ── Login com senha ────────────────────────────────────────────────
		if (action === 'login_password') {
			if (!phone || !password) {
				return res.status(400).json({ ok: false, error: 'phone e password são obrigatórios' });
			}

			const { data: client } = await supabase
				.from('clients')
				.select('id, phone, password_hash')
				.eq('phone', phone)
				.maybeSingle();

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

			await supabase
				.from('registered_clients')
				.update({ last_login: new Date().toISOString(), updated_at: new Date().toISOString() })
				.eq('phone', phone);

			issueClientSession(res, String(client.id), phone);
			return res.status(200).json({ ok: true, phone: client.phone || phone });
		}

		// ── Troca de senha (sessão ativa OU senha atual) ────────────────────
		if (action === 'set_password') {
			const newPassword = String(body?.new_password || body?.password || '');
			const currentPassword = String(body?.current_password || '');
			if (newPassword.length < 8) {
				return res.status(400).json({ ok: false, error: 'A senha deve ter pelo menos 8 caracteres' });
			}

			const session = getSession(req, 'client');
			let clientId: string | null = null;

			if (session && session.role === 'client') {
				clientId = session.sub;
			} else {
				// Sem sessão, exige a senha atual — nunca só o telefone.
				if (!phone || !currentPassword) {
					return res.status(401).json({
						ok: false,
						error: 'Faça login ou informe a senha atual para trocar a senha.',
					});
				}
				const { data: client } = await supabase
					.from('clients')
					.select('id, password_hash')
					.eq('phone', phone)
					.maybeSingle();
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

		// ── Solicitar código de redefinição ────────────────────────────────
		if (action === 'request_reset') {
			// Resposta sempre genérica: não revela se o número tem conta.
			const generic = {
				ok: true,
				message: 'Se houver uma conta para este WhatsApp, você receberá um código em instantes.',
			};
			if (!isValidPhone(phone)) {
				return res.status(400).json({ ok: false, error: 'Informe um celular válido com DDD e o 9' });
			}

			const { data: client } = await supabase
				.from('clients')
				.select('id, name')
				.eq('phone', phone)
				.maybeSingle();
			if (!client?.id) return res.status(200).json(generic);

			// Anti-spam: um envio por minuto por número.
			const { data: recent } = await supabase
				.from('client_password_resets')
				.select('created_at')
				.eq('phone', phone)
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle();
			if (recent?.created_at) {
				const elapsed = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
				if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) return res.status(200).json(generic);
			}

			const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
			const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

			// Invalida códigos anteriores ainda pendentes.
			await supabase
				.from('client_password_resets')
				.update({ used: true })
				.eq('phone', phone)
				.eq('used', false);

			const { error: insErr } = await supabase.from('client_password_resets').insert({
				client_id: client.id,
				phone,
				code_hash: tokenHash(code),
				expires_at: expiresAt.toISOString(),
				attempts: 0,
				used: false,
			});
			if (insErr) {
				console.error('[client-auth] Erro ao gravar código:', insErr.message);
				return res.status(200).json(generic);
			}

			await sendOtpViaWhatsApp(client.name || 'Cliente', phone, code);
			return res.status(200).json(generic);
		}

		// ── Confirmar código e trocar a senha ──────────────────────────────
		if (action === 'reset_with_code') {
			const code = String(body?.code || '').replace(/\D/g, '');
			const newPassword = String(body?.new_password || body?.password || '');

			if (!phone || !code) {
				return res.status(400).json({ ok: false, error: 'phone e code são obrigatórios' });
			}
			if (newPassword.length < 8) {
				return res.status(400).json({ ok: false, error: 'A senha deve ter pelo menos 8 caracteres' });
			}

			const { data: reset } = await supabase
				.from('client_password_resets')
				.select('id, client_id, code_hash, expires_at, attempts, used')
				.eq('phone', phone)
				.eq('used', false)
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle();

			const invalid = { ok: false, error: 'Código inválido ou expirado' };
			if (!reset?.id) return res.status(400).json(invalid);

			if (new Date() > new Date(reset.expires_at) || reset.attempts >= OTP_MAX_ATTEMPTS) {
				await supabase.from('client_password_resets').update({ used: true }).eq('id', reset.id);
				return res.status(400).json(invalid);
			}

			if (tokenHash(code) !== reset.code_hash) {
				await supabase
					.from('client_password_resets')
					.update({ attempts: reset.attempts + 1 })
					.eq('id', reset.id);
				return res.status(400).json(invalid);
			}

			const { error: upErr } = await supabase
				.from('clients')
				.update({ password_hash: hashPassword(newPassword), updated_at: new Date().toISOString() })
				.eq('id', reset.client_id);
			if (upErr) return res.status(500).json({ ok: false, error: upErr.message });

			await supabase.from('client_password_resets').update({ used: true }).eq('id', reset.id);

			issueClientSession(res, String(reset.client_id), phone);
			return res.status(200).json({ ok: true, phone });
		}

		return res.status(400).json({ ok: false, error: 'Ação inválida' });
	} catch (err: any) {
		console.error('[client-auth] Erro inesperado:', err?.message || err);
		return res.status(500).json({ ok: false, error: 'Erro inesperado' });
	}
}
