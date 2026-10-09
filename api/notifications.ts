import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireAdmin } from './_lib/session.js';
import { verifyAbacatePayWebhook, processAbacatePayWebhook } from './_lib/subscription-webhooks.js';
import { hardenErrors } from './_lib/http.js';
import { ValidationError, validateUuid } from './_lib/validation.js';
import {
	ensurePushCronToken,
	getVapidPublicKey,
	isMissingPushTable,
	isReminderAuthorized,
	sendDueReminders,
} from './_lib/push.js';

function getSupabaseServer() {
	const supabaseUrl =
		process.env.SUPABASE_URL ||
		process.env.VITE_SUPABASE_URL;
	const supabaseKey =
		process.env.SUPABASE_SERVICE_ROLE_KEY ||
		process.env.VITE_SUPABASE_ANON_KEY;
	if (!supabaseUrl || !supabaseKey) {
		throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados');
	}
	return createSupabaseClient(supabaseUrl, supabaseKey);
}

const PUSH_SETUP_ERROR = 'Execute sql/push-notifications-schema.sql no Supabase para ativar as notificações.';

function parseBody(req: any): any {
	const raw = req?.body ?? {};
	if (typeof raw === 'string') {
		try { return JSON.parse(raw); } catch { return {}; }
	}
	if (Buffer.isBuffer(raw)) {
		try { return JSON.parse(raw.toString('utf8')); } catch { return {}; }
	}
	return raw && typeof raw === 'object' ? raw : {};
}

async function readRawBody(req: any): Promise<string> {
	if (typeof req.body === 'string') return req.body;
	if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
	if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
	return '';
}

export default async function handler(req: any, res: any) {
	hardenErrors(req, res);
	try {
		const url = new URL(req?.url || '/', 'http://localhost');

		if (req.method === 'POST' && url.searchParams.get('provider') === 'abacatepay') {
			const rawBody = await readRawBody(req);
			if (!verifyAbacatePayWebhook(req, rawBody)) {
				return res.status(401).json({ ok: false, error: 'Webhook não autorizado' });
			}
			let payload: any;
			try {
				payload = JSON.parse(rawBody);
			} catch {
				return res.status(400).json({ ok: false, error: 'JSON inválido' });
			}

			const supabase = getSupabaseServer();
			try {
				const result = await processAbacatePayWebhook(supabase, payload);
				return res.status(200).json({ ok: true, ...result });
			} catch (e: any) {
				console.error('[abacatepay-webhook]', e?.message || e);
				return res.status(500).json({ ok: false, error: 'Falha ao processar webhook' });
			}
		}

		if (req.method === 'GET' && url.searchParams.get('job') === 'reminders') {
			const supabase = getSupabaseServer();
			const cronOk = await isReminderAuthorized(req, supabase);
			if (!cronOk && !requireAdmin(req, res)) return;
			const result = await sendDueReminders(supabase);
			if (!result.ok && result.error && /push-notifications-schema/i.test(result.error)) {
				return res.status(200).json({ ok: false, sent: 0, error: PUSH_SETUP_ERROR });
			}
			if (!result.ok) return res.status(500).json({ ok: false, error: result.error || 'Falha ao enviar lembretes' });
			return res.status(200).json({ ok: true, sent: result.sent });
		}

		if (req.method === 'GET' && url.searchParams.get('push') === 'config') {
			const session = requireAdmin(req, res);
			if (!session) return;
			let publicKey = '';
			try {
				publicKey = getVapidPublicKey();
			} catch (err: any) {
				return res.status(500).json({ ok: false, error: err?.message || 'Chave de notificação indisponível' });
			}
			const supabase = getSupabaseServer();
			await ensurePushCronToken(supabase);
			const { data, error } = await supabase
				.from('push_subscriptions')
				.select('endpoint, professional_id')
				.eq('admin_id', session.sub);
			if (error) {
				if (isMissingPushTable(error)) {
					return res.status(200).json({ ok: true, publicKey, subscriptions: [], setupRequired: true });
				}
				return res.status(500).json({ ok: false, error: error.message });
			}
			return res.status(200).json({ ok: true, publicKey, subscriptions: data || [], setupRequired: false });
		}

		if (req.method === 'POST') {
			const session = requireAdmin(req, res);
			if (!session) return;
			const body = parseBody(req);
			const action = String(body?.action || '');
			const supabase = getSupabaseServer();
			await ensurePushCronToken(supabase);

			if (action === 'unsubscribe') {
				const endpoint = String(body?.endpoint || '').trim();
				if (!endpoint) return res.status(400).json({ ok: false, error: 'endpoint é obrigatório' });
				const { error } = await supabase
					.from('push_subscriptions')
					.delete()
					.eq('endpoint', endpoint)
					.eq('admin_id', session.sub);
				if (error && !isMissingPushTable(error)) return res.status(500).json({ ok: false, error: error.message });
				return res.status(200).json({ ok: true });
			}

			if (action !== 'subscribe') {
				return res.status(400).json({ ok: false, error: 'Ação inválida' });
			}

			const subscription = body?.subscription || {};
			const endpoint = String(subscription?.endpoint || '').trim();
			const p256dh = String(subscription?.keys?.p256dh || '').trim();
			const auth = String(subscription?.keys?.auth || '').trim();
			if (!endpoint.startsWith('https://') || endpoint.length > 2000) {
				return res.status(400).json({ ok: false, error: 'Inscrição de notificação inválida' });
			}
			if (!p256dh || !auth || p256dh.length > 200 || auth.length > 200) {
				return res.status(400).json({ ok: false, error: 'Chaves da inscrição inválidas' });
			}

			let professionalId: string | null = null;
			if (body?.professional_id) {
				try {
					professionalId = validateUuid(String(body.professional_id), 'Profissional');
				} catch (err: any) {
					if (err instanceof ValidationError) return res.status(400).json({ ok: false, error: err.message });
					throw err;
				}
			}

			const { error } = await supabase.from('push_subscriptions').upsert({
				admin_id: session.sub,
				professional_id: professionalId,
				endpoint,
				p256dh,
				auth,
				updated_at: new Date().toISOString(),
			}, { onConflict: 'endpoint' });
			if (error) {
				if (isMissingPushTable(error)) return res.status(400).json({ ok: false, error: PUSH_SETUP_ERROR });
				if (error.code === '23503') return res.status(400).json({ ok: false, error: 'Profissional não encontrado' });
				return res.status(500).json({ ok: false, error: error.message });
			}
			return res.status(200).json({ ok: true, professional_id: professionalId });
		}

		if (req.method !== 'GET') {
			res.setHeader('Allow', 'GET, POST');
			return res.status(405).json({ ok: false, error: 'Método não permitido' });
		}

		if (!requireAdmin(req, res)) return;

		const supabase = getSupabaseServer();
		const sinceParam = url.searchParams.get('since') || '';
		let since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
		if (sinceParam) {
			const d = new Date(sinceParam);
			if (!isNaN(d.getTime())) since = d.toISOString();
		}

		const bookingsQ = supabase
			.from('bookings')
			.select(`id, date, time, created_at, clients:client_id ( id, name, phone )`)
			.gte('created_at', since)
			.order('created_at', { ascending: false })
			.limit(50);

		const cancelsQ = supabase
			.from('booking_cancellations')
			.select(`id, created_at, cancelled_by, bookings:booking_id ( id, date, time, clients:client_id ( id, name, phone ) )`)
			.eq('cancelled_by', 'client')
			.gte('created_at', since)
			.order('created_at', { ascending: false })
			.limit(50);

		const reschedQ = supabase
			.from('reschedule_requests')
			.select('id, requested_date, requested_time, status, created_at, booking_id')
			.gte('created_at', since)
			.order('created_at', { ascending: false })
			.limit(50);

		const [bookings, cancels, resched] = await Promise.all([bookingsQ, cancelsQ, reschedQ]);
		if (bookings.error) return res.status(500).json({ ok: false, error: bookings.error.message });
		if (cancels.error) return res.status(500).json({ ok: false, error: cancels.error.message });
		if (resched.error) return res.status(500).json({ ok: false, error: resched.error.message });

		const items: Array<any> = [];

		(bookings.data || []).forEach((b: any) => {
			items.push({
				type: 'booking',
				id: b.id,
				at: b.created_at,
				date: b.date,
				time: b.time,
				client_name: b.clients?.name || 'Cliente',
				client_phone: b.clients?.phone || '',
			});
		});
		(cancels.data || []).forEach((c: any) => {
			items.push({
				type: 'cancellation',
				id: c.id,
				at: c.created_at,
				date: c.bookings?.date,
				time: c.bookings?.time,
				client_name: c.bookings?.clients?.name || 'Cliente',
				client_phone: c.bookings?.clients?.phone || '',
			});
		});
		(resched.data || []).forEach((r: any) => {
			items.push({
				type: 'reschedule_request',
				id: r.id,
				at: r.created_at,
				requested_date: r.requested_date,
				requested_time: r.requested_time,
				status: r.status,
				booking_id: r.booking_id,
			});
		});

		items.sort((a, b) => String(b.at).localeCompare(String(a.at)));

		return res.status(200).json({ ok: true, items });
	} catch (err: any) {
		return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
	}
}
