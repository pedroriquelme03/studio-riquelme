// Web Push do PWA do painel (novos agendamentos e lembrete ~1h antes).
// Mantido em _lib/ para não contar como Serverless Function no Vercel Hobby.
//
// As chaves VAPID vêm de VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.
// Se não existirem, são derivadas de SESSION_SECRET — estáveis entre instâncias,
// sem gravar a chave privada no banco.

import { createECDH, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import webpush from 'web-push';
import { formatDateToPtBr, formatTimeToHHMM } from './whatsapp.js';
import { nowInSalon } from './schedule-rules.js';
import { toMinutes } from './time-slots.js';

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@studioriquelme.com.br';

/** Janela em que o lembrete sai: no máximo 1h antes, no mínimo 45 min (o cron de 5 min sempre alcança). */
export const REMINDER_MAX_MINUTES = 60;
export const REMINDER_MIN_MINUTES = 45;

type WebPushClient = {
	setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
	sendNotification: (
		subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
		payload: string,
		options?: { TTL?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high' },
	) => Promise<unknown>;
};

const webpushClient: WebPushClient = ((webpush as any).default || webpush) as WebPushClient;

export type PushBookingNotice = {
	bookingId: string;
	professionalId: string | null;
	clientName: string;
	date: string;
	time: string;
	serviceLabel?: string;
};

type PushSubRow = {
	endpoint: string;
	p256dh: string;
	auth: string;
	professional_id: string | null;
};

export function isMissingPushTable(error: { code?: string; message?: string } | null | undefined): boolean {
	if (!error) return false;
	if (error.code === '42P01' || error.code === 'PGRST205') return true;
	return /push_subscriptions|push_reminder_sent|push_runtime/i.test(String(error.message || ''));
}

export function minutesUntilAppointment(
	date: string,
	time: string,
	now: { date: string; minutes: number },
): number {
	const dayDiff = Math.round(
		(Date.parse(`${date}T12:00:00Z`) - Date.parse(`${now.date}T12:00:00Z`)) / 86_400_000,
	);
	return dayDiff * 1440 + toMinutes(time) - now.minutes;
}

export function isReminderDue(minutesUntil: number): boolean {
	return minutesUntil <= REMINDER_MAX_MINUTES && minutesUntil >= REMINDER_MIN_MINUTES;
}

function deriveVapidKeys(secret: string): { publicKey: string; privateKey: string } {
	for (let i = 0; i < 8; i++) {
		const priv = createHash('sha256').update(`vapid-p256:${i}:${secret}`).digest();
		try {
			const ecdh = createECDH('prime256v1');
			ecdh.setPrivateKey(priv);
			const pub = ecdh.getPublicKey();
			if (pub.length !== 65) continue;
			return {
				publicKey: pub.toString('base64url'),
				privateKey: priv.toString('base64url'),
			};
		} catch {
			continue;
		}
	}
	throw new Error('Não foi possível derivar as chaves VAPID');
}

export function getVapidKeys(): { publicKey: string; privateKey: string; subject: string } {
	const fromEnvPub = (process.env.VAPID_PUBLIC_KEY || '').trim();
	const fromEnvPriv = (process.env.VAPID_PRIVATE_KEY || '').trim();
	if (fromEnvPub && fromEnvPriv) {
		return { publicKey: fromEnvPub, privateKey: fromEnvPriv, subject: VAPID_SUBJECT };
	}
	const secret = process.env.SESSION_SECRET || '';
	if (secret.length < 32) throw new Error('SESSION_SECRET não configurada');
	return { ...deriveVapidKeys(secret), subject: VAPID_SUBJECT };
}

function configureWebPush(): string {
	const { publicKey, privateKey, subject } = getVapidKeys();
	webpushClient.setVapidDetails(subject, publicKey, privateKey);
	return publicKey;
}

export function getVapidPublicKey(): string {
	return configureWebPush();
}

function bearerToken(req: any): string {
	const header = String(req?.headers?.authorization || '');
	return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

function hashesEqual(a: string, b: string): boolean {
	const left = createHash('sha256').update(a).digest();
	const right = createHash('sha256').update(b).digest();
	return timingSafeEqual(left, right);
}

export function isCronAuthorized(req: any): boolean {
	const secret = (process.env.CRON_SECRET || '').trim();
	const token = bearerToken(req);
	if (!secret || !token) return false;
	return hashesEqual(token, secret);
}

/** Token que o pg_cron do Supabase usa para chamar o lembrete com o painel fechado. */
export async function ensurePushCronToken(supabase: any): Promise<void> {
	try {
		const { data, error } = await supabase.from('push_runtime').select('value').eq('key', 'cron_token').maybeSingle();
		if (error || data?.value) return;
		await supabase.from('push_runtime').upsert({
			key: 'cron_token',
			value: randomBytes(32).toString('hex'),
			updated_at: new Date().toISOString(),
		});
	} catch {
		// A tabela é opcional até o SQL ser executado.
	}
}

export async function isReminderAuthorized(req: any, supabase: any): Promise<boolean> {
	if (isCronAuthorized(req)) return true;
	const token = bearerToken(req);
	if (!token) return false;
	try {
		const { data, error } = await supabase.from('push_runtime').select('value').eq('key', 'cron_token').maybeSingle();
		if (error || !data?.value) return false;
		return hashesEqual(token, String(data.value));
	} catch {
		return false;
	}
}

function matchesProfessional(sub: PushSubRow, professionalId: string | null): boolean {
	if (!professionalId || !sub.professional_id) return true;
	return sub.professional_id === professionalId;
}

async function loadSubscriptions(supabase: any): Promise<PushSubRow[]> {
	const { data, error } = await supabase
		.from('push_subscriptions')
		.select('endpoint, p256dh, auth, professional_id');
	if (error) throw error;
	return (data || []) as PushSubRow[];
}

function appointmentBody(notice: { clientName: string; date: string; time: string; serviceLabel?: string }, whenLabel?: string): string {
	const who = String(notice.clientName || 'Cliente').trim() || 'Cliente';
	const when = whenLabel || `${formatDateToPtBr(notice.date)} às ${formatTimeToHHMM(notice.time)}`;
	const service = String(notice.serviceLabel || '').trim();
	return service ? `${who} · ${when} · ${service}` : `${who} · ${when}`;
}

/**
 * Avisa os aparelhos inscritos. Não lança: falha de push não pode desfazer o agendamento.
 * Retorna false se a tabela ainda não existe.
 */
async function deliverNewBookings(supabase: any, notices: PushBookingNotice[]): Promise<boolean> {
	const list = (notices || []).filter((n) => n?.bookingId);
	if (!list.length) return true;
	try {
		const subs = await loadSubscriptions(supabase);
		if (!subs.length) return true;
		for (const notice of list) {
			const targets = subs.filter((s) => matchesProfessional(s, notice.professionalId));
			if (!targets.length) continue;
			await deliverOnce(supabase, targets, {
				title: 'Novo agendamento',
				body: appointmentBody(notice),
				url: '/admin',
				tag: `booking-${notice.bookingId}`,
			}, 60 * 60);
		}
		return true;
	} catch (err: any) {
		if (isMissingPushTable(err)) {
			console.warn('[push] tabelas ausentes; execute sql/push-notifications-schema.sql');
			return false;
		}
		console.error('[push] novo agendamento:', err?.message || err);
		return false;
	}
}

/** Não segura a resposta do agendamento se o serviço de push demorar. */
export function notifyNewBookings(supabase: any, notices: PushBookingNotice[]): Promise<boolean> {
	return new Promise((resolve) => {
		const timer = setTimeout(() => resolve(false), 5000);
		deliverNewBookings(supabase, notices).then((ok) => {
			clearTimeout(timer);
			resolve(ok);
		}).catch(() => {
			clearTimeout(timer);
			resolve(false);
		});
	});
}

async function deliverOnce(
	supabase: any,
	targets: PushSubRow[],
	payload: { title: string; body: string; url: string; tag: string },
	ttlSeconds: number,
): Promise<number> {
	configureWebPush();
	let delivered = 0;
	await Promise.all(targets.map(async (sub) => {
		try {
			await webpushClient.sendNotification(
				{ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
				JSON.stringify(payload),
				{ TTL: ttlSeconds, urgency: 'high' },
			);
			delivered += 1;
		} catch (err: any) {
			const status = Number(err?.statusCode || 0);
			if (status === 404 || status === 410) {
				await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
				return;
			}
			console.error('[push] falha ao enviar:', status || err?.message || err);
		}
	}));
	return delivered;
}

function serviceLabelOf(booking: any): string {
	const names = (booking?.booking_services || [])
		.map((bs: any) => {
			const svc = bs?.services;
			const row = Array.isArray(svc) ? svc[0] : svc;
			return String(row?.name || '').trim();
		})
		.filter(Boolean);
	return names.join(', ');
}

function clientNameOf(booking: any): string {
	const clients = booking?.clients;
	const row = Array.isArray(clients) ? clients[0] : clients;
	return String(row?.name || 'Cliente').trim() || 'Cliente';
}

function addDays(date: string, days: number): string {
	const d = new Date(`${date}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

/** Envia lembretes que estão na janela de 1 hora e ainda não foram enviados. */
export async function sendDueReminders(supabase: any): Promise<{ ok: boolean; sent: number; error?: string }> {
	const now = nowInSalon();
	const dates = [now.date, addDays(now.date, 1)];
	const { data, error } = await supabase
		.from('bookings')
		.select(`
			id, date, time, professional_id, cancelled_at, completed_at,
			clients:client_id ( name ),
			booking_services ( services:service_id ( name ) )
		`)
		.in('date', dates)
		.is('cancelled_at', null);

	if (error) {
		if (isMissingPushTable(error)) {
			return { ok: false, sent: 0, error: 'Execute sql/push-notifications-schema.sql no Supabase.' };
		}
		// completed_at pode não existir em bases antigas: tenta de novo sem ela.
		if (/completed_at/i.test(error.message || '')) {
			const retry = await supabase
				.from('bookings')
				.select(`
					id, date, time, professional_id, cancelled_at,
					clients:client_id ( name ),
					booking_services ( services:service_id ( name ) )
				`)
				.in('date', dates)
				.is('cancelled_at', null);
			if (retry.error) return { ok: false, sent: 0, error: retry.error.message };
			return sendRemindersForRows(supabase, retry.data || [], now);
		}
		return { ok: false, sent: 0, error: error.message };
	}

	const rows = (data || []).filter((row: any) => !row.completed_at && !row.cancelled_at);
	return sendRemindersForRows(supabase, rows, now);
}

async function sendRemindersForRows(
	supabase: any,
	rows: any[],
	now: { date: string; minutes: number },
): Promise<{ ok: boolean; sent: number; error?: string }> {
	const due = rows.filter((row) => isReminderDue(minutesUntilAppointment(String(row.date), String(row.time), now)));
	if (!due.length) return { ok: true, sent: 0 };

	let subs: PushSubRow[] = [];
	try {
		subs = await loadSubscriptions(supabase);
	} catch (err: any) {
		if (isMissingPushTable(err)) {
			return { ok: false, sent: 0, error: 'Execute sql/push-notifications-schema.sql no Supabase.' };
		}
		return { ok: false, sent: 0, error: err?.message || 'Falha ao ler inscrições' };
	}
	if (!subs.length) return { ok: true, sent: 0 };

	let sent = 0;
	for (const row of due) {
		const bookingId = String(row.id);
		const targets = subs.filter((s) => matchesProfessional(s, row.professional_id ? String(row.professional_id) : null));
		if (!targets.length) continue;

		const { data: claimed, error: claimErr } = await supabase
			.from('push_reminder_sent')
			.insert({ booking_id: bookingId })
			.select('booking_id')
			.maybeSingle();
		if (claimErr) {
			if (claimErr.code === '23505') continue;
			if (isMissingPushTable(claimErr)) {
				return { ok: false, sent, error: 'Execute sql/push-notifications-schema.sql no Supabase.' };
			}
			console.error('[push] claim lembrete:', claimErr.message);
			continue;
		}
		if (!claimed) continue;

		const when = String(row.date) === now.date
			? `hoje às ${formatTimeToHHMM(String(row.time))}`
			: `amanhã às ${formatTimeToHHMM(String(row.time))}`;
		const delivered = await deliverOnce(supabase, targets, {
			title: 'Atendimento em 1 hora',
			body: appointmentBody({
				clientName: clientNameOf(row),
				date: String(row.date),
				time: String(row.time),
				serviceLabel: serviceLabelOf(row),
			}, when),
			url: '/admin',
			tag: `reminder-${bookingId}`,
		}, 15 * 60);

		if (!delivered) {
			await supabase.from('push_reminder_sent').delete().eq('booking_id', bookingId);
			continue;
		}
		sent += 1;
	}
	return { ok: true, sent };
}

/** Horário mudou: o lembrete de 1h precisa poder sair de novo. */
export async function forgetPushReminders(supabase: any, bookingIds: string[]): Promise<void> {
	const ids = (bookingIds || []).map((id) => String(id || '').trim()).filter(Boolean);
	if (!ids.length) return;
	const { error } = await supabase.from('push_reminder_sent').delete().in('booking_id', ids);
	if (error && !isMissingPushTable(error)) {
		console.error('[push] lembrete não resetado:', error.message);
	}
}
