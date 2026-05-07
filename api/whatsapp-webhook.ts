/**
 * Webhook WhatsApp Business Platform (Cloud API)
 * @see https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/
 *
 * URL de callback (Vercel): https://<seu-dominio>/api/whatsapp-webhook
 *
 * Se studioriquelme.com.br for só hospedagem estática (sem /api), use a Edge Function Supabase em:
 * https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook
 * Ver supabase/functions/whatsapp-webhook/index.ts — deploy com: supabase functions deploy whatsapp-webhook
 *
 * Variáveis de ambiente:
 * - WHATSAPP_WEBHOOK_VERIFY_TOKEN (obrigatório) — defina uma frase secreta no Vercel (ex.: minha-frase-secreta-x7k).
 *   No painel Meta, em "Verificar token", cole essa **mesma frase** — não use o texto literal "WHATSAPP_WEBHOOK_VERIFY_TOKEN".
 * - WHATSAPP_APP_SECRET (recomendado) — App Secret do app Meta; habilita validação de X-Hub-Signature-256
 *
 * No Meta App Dashboard: WhatsApp → Configuration → Webhook → assine o campo "messages"
 * (mensagens recebidas + status de entrega/leitura das enviadas).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

function getVerifyToken(): string | undefined {
	return process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() || undefined;
}

function getAppSecret(): string | undefined {
	return process.env.WHATSAPP_APP_SECRET?.trim() || undefined;
}

/** Parâmetros hub.* da Meta (GET de verificação), tolerando req.url só com path atrás de proxy. */
function getMetaVerifyQuery(req: any): URLSearchParams {
	try {
		const raw = typeof req.url === 'string' ? req.url : '';
		if (raw.includes('?')) return new URLSearchParams(raw.slice(raw.indexOf('?') + 1));
	} catch {
		/* noop */
	}
	const q = req.query;
	if (q && typeof q === 'object') {
		const sp = new URLSearchParams();
		for (const [k, val] of Object.entries(q)) {
			const v = Array.isArray(val) ? val[0] : val;
			if (typeof v === 'string') sp.append(k, v);
		}
		return sp;
	}
	return new URLSearchParams();
}

/**
 * Corpo bruto para assinatura Meta (HMAC-SHA256 do payload).
 * No Vercel, o corpo às vezes já vem parseado em req.body; nesse caso a assinatura não pode ser validada.
 */
async function readRawBody(req: any): Promise<Buffer | null> {
	if (Buffer.isBuffer(req.body)) return req.body;
	if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');
	if (req.body != null && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
		return null;
	}
	const chunks: Buffer[] = [];
	try {
		for await (const chunk of req) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		}
	} catch {
		return null;
	}
	if (chunks.length === 0) return null;
	return Buffer.concat(chunks);
}

function verifyMetaSignature(rawBody: Buffer, signatureHeader: string | undefined, appSecret: string): boolean {
	if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
	const receivedHex = signatureHeader.slice('sha256='.length);
	const expectedHex = createHmac('sha256', appSecret).update(rawBody).digest('hex');
	try {
		return timingSafeEqual(Buffer.from(receivedHex, 'hex'), Buffer.from(expectedHex, 'hex'));
	} catch {
		return false;
	}
}

function summarizeWebhook(body: Record<string, unknown>): unknown {
	const object = body?.object;
	if (object !== 'whatsapp_business_account') {
		return { object };
	}

	const summaries: unknown[] = [];
	const entries = (body as { entry?: unknown[] }).entry || [];

	for (const entry of entries) {
		const e = entry as { id?: string; changes?: unknown[] };
		const changes = e.changes || [];
		for (const ch of changes) {
			const change = ch as { field?: string; value?: Record<string, unknown> };
			const field = change.field;
			const value = change.value || {};
			const row: Record<string, unknown> = { waba_entry_id: e.id, field };

			if (field === 'messages') {
				const messages = value.messages as unknown[] | undefined;
				const statuses = value.statuses as unknown[] | undefined;
				if (messages?.length) {
					row.incoming_messages = messages.length;
					row.samples = messages.slice(0, 3).map((m: any) => ({
						from: m.from,
						type: m.type,
						id: m.id,
						timestamp: m.timestamp,
					}));
				}
				if (statuses?.length) {
					row.status_updates = statuses.length;
					row.status_samples = statuses.slice(0, 5).map((s: any) => ({
						id: s.id,
						status: s.status,
						timestamp: s.timestamp,
						recipient_id: s.recipient_id,
					}));
				}
			}

			const meta = value.metadata as { display_phone_number?: string; phone_number_id?: string } | undefined;
			if (meta) {
				row.phone_number_id = meta.phone_number_id;
				row.display_phone_number = meta.display_phone_number;
			}

			summaries.push(row);
		}
	}

	return summaries;
}

export default async function handler(req: any, res: any) {
	const sendJson = (status: number, body: object) => {
		try {
			res.status(status).json(body);
		} catch {
			res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));
		}
	};

	const verifyToken = getVerifyToken();

	// ── Verificação do webhook (GET) ─────────────────────────────────────
	if (req.method === 'GET') {
		if (!verifyToken) {
			return sendJson(500, { ok: false, error: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN não configurado' });
		}
		try {
			const sp = getMetaVerifyQuery(req);
			const mode = sp.get('hub.mode');
			const token = sp.get('hub.verify_token');
			const challenge = sp.get('hub.challenge');

			if (mode === 'subscribe' && token === verifyToken && challenge) {
				res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
				res.end(challenge);
				return;
			}
			return sendJson(403, { ok: false, error: 'Falha na verificação do webhook (token ou modo inválido)' });
		} catch (e: any) {
			return sendJson(500, { ok: false, error: e?.message || 'Erro na verificação GET' });
		}
	}

	// ── Eventos (POST) ───────────────────────────────────────────────────
	if (req.method === 'POST') {
		const appSecret = getAppSecret();
		let raw: Buffer | null = null;
		let payload: Record<string, unknown>;

		try {
			raw = await readRawBody(req);
		} catch {
			raw = null;
		}

		if (raw && raw.length > 0) {
			const sig = req.headers?.['x-hub-signature-256'] as string | undefined;
			if (appSecret) {
				if (!verifyMetaSignature(raw, sig, appSecret)) {
					return sendJson(403, { ok: false, error: 'Assinatura X-Hub-Signature-256 inválida' });
				}
			}
			try {
				payload = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
			} catch {
				return sendJson(400, { ok: false, error: 'JSON inválido no corpo' });
			}
		} else if (req.body && typeof req.body === 'object') {
			if (appSecret) {
				console.warn(
					'[whatsapp-webhook] WHATSAPP_APP_SECRET definido mas corpo já veio parseado; validação de assinatura ignorada. ' +
						'Em produção, prefira ambiente onde o corpo bruto esteja disponível.',
				);
			}
			payload = req.body as Record<string, unknown>;
		} else {
			return sendJson(400, { ok: false, error: 'Corpo da requisição vazio ou ilegível' });
		}

		try {
			const summary = summarizeWebhook(payload);
			console.log('[whatsapp-webhook] evento recebido:', JSON.stringify(summary));
		} catch (e: any) {
			console.error('[whatsapp-webhook] erro ao resumir payload:', e?.message || e);
		}

		// Resposta rápida 200 — a Meta re-tenta se não receber 200 (até ~7 dias).
		return sendJson(200, { ok: true });
	}

	res.setHeader('Allow', 'GET, POST');
	return sendJson(405, { ok: false, error: 'Método não permitido' });
}
