// Ferramentas do agente de WhatsApp (n8n + Evolution API).
// Mantido em _lib/ para não contar como Serverless Function no Vercel Hobby —
// é servido por /api/whatsapp-webhook?agent=<ação>.
//
// Todas as chamadas são POST com JSON e exigem o header `x-agent-key` igual a
// AGENT_API_KEY (definir na Vercel, mínimo 24 caracteres).
//
// O telefone do cliente vem SEMPRE do n8n (número que mandou a mensagem), nunca
// do modelo: é ele que garante que o agente só veja/cancele agendamentos do
// próprio cliente.
//
// Ações:
//   context  { phone }                         → data/hora atual, cliente e próximos agendamentos
//   catalog  {}                                → serviços, profissionais, horários e endereço
//   slots    { service_ids, date, professional_id? }           → horários livres
//   book     { phone, name, service_ids, date, time, professional_id?, hair_size? }
//   bookings { phone }                         → próximos agendamentos do cliente
//   cancel   { phone, booking_id }             → cancela um agendamento do cliente
//   remember { phone, content }                → guarda um fato/preferência do cliente
//   forget   { phone, memory_id }              → apaga uma memória do cliente
//
// A memória fica em agent_client_memories (sql/agent-memory-schema.sql) e é
// devolvida em `context`, então o agente já começa cada conversa sabendo dela.

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import bookingsHandler from '../bookings.js';
import { createSessionToken, safeEqual } from './session.js';
import { loadDayWindowForProfessional } from './promotions.js';
import { HAIR_SIZE_VARIANT_DEFS, loadVariantsByServiceIds } from './price-variations.js';
import {
	fromMinutes,
	getBookingServicesDurationMinutes,
	getSlotStep,
	overlaps,
	toMinutes,
	type DayWindow,
} from './time-slots.js';

const TIME_ZONE = 'America/Sao_Paulo';
const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

class AgentError extends Error {
	status: number;
	extra?: Record<string, unknown>;
	constructor(message: string, status = 400, extra?: Record<string, unknown>) {
		super(message);
		this.status = status;
		this.extra = extra;
	}
}

function getSupabase() {
	const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
	const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
	if (!supabaseUrl || !supabaseKey) {
		throw new AgentError('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados', 500);
	}
	return createSupabaseClient(supabaseUrl, supabaseKey);
}

/** Data, hora e dia da semana no fuso do salão (a Vercel roda em UTC). */
function nowInSalon(): { date: string; time: string; minutes: number; weekday: number } {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: TIME_ZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).formatToParts(new Date());
	const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
	const date = `${get('year')}-${get('month')}-${get('day')}`;
	const time = `${get('hour')}:${get('minute')}`;
	return { date, time, minutes: toMinutes(time), weekday: weekdayOf(date) };
}

function weekdayOf(date: string): number {
	return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function isValidDate(date: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
	const d = new Date(`${date}T12:00:00Z`);
	return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/**
 * Telefone no formato em que o site grava (DDD + número, só dígitos).
 * O WhatsApp entrega 55 + DDD + número e, em contas antigas, sem o 9º dígito.
 */
export function toLocalPhone(input: unknown): string {
	let d = String(input ?? '').replace(/\D/g, '');
	if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2);
	if (d.length === 10 && /[6-9]/.test(d[2])) d = `${d.slice(0, 2)}9${d.slice(2)}`;
	return d.length === 10 || d.length === 11 ? d : '';
}

function phoneVariants(local: string): string[] {
	const variants = new Set<string>([local, `55${local}`]);
	if (local.length === 11) {
		const withoutNine = `${local.slice(0, 2)}${local.slice(3)}`;
		variants.add(withoutNine);
		variants.add(`55${withoutNine}`);
	}
	return Array.from(variants);
}

function requirePhone(body: any): string {
	const phone = toLocalPhone(body?.phone);
	if (!phone) throw new AgentError('Telefone do cliente não identificado');
	return phone;
}

/** Aceita [3, 7], "3,7" ou "3" — o n8n envia os parâmetros do modelo como texto. */
function parseServiceIds(input: unknown): number[] {
	const raw = Array.isArray(input) ? input : String(input ?? '').split(/[^\d]+/);
	const ids = raw.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);
	return Array.from(new Set(ids));
}

async function findClients(supabase: any, phone: string) {
	const { data, error } = await supabase
		.from('clients')
		.select('id, name, phone, email, notes')
		.in('phone', phoneVariants(phone));
	if (error) throw new AgentError(error.message, 500);
	return (data || []) as Array<{ id: string; name: string; phone: string; email: string | null; notes: string | null }>;
}

async function loadServices(supabase: any, serviceIds: number[]) {
	if (!serviceIds.length) throw new AgentError('Informe service_ids (IDs dos serviços do catálogo)');
	const { data, error } = await supabase
		.from('services')
		.select('id, name, price, duration_minutes, responsible_professional_id, price_variation_enabled')
		.in('id', serviceIds);
	if (error) throw new AgentError(error.message, 500);
	const found = new Set((data || []).map((r: any) => Number(r.id)));
	const missing = serviceIds.filter((id) => !found.has(id));
	if (missing.length) throw new AgentError(`Serviços inexistentes: ${missing.join(', ')}. Consulte o catálogo.`);
	return data as any[];
}

/** Mesma regra do site: sem profissional escolhido, vale o responsável pelos serviços. */
function resolveProfessionalId(services: any[], requested: unknown): string | null {
	const explicit = String(requested ?? '').trim();
	if (explicit) return explicit;
	const distinct = Array.from(new Set(services.map((s) => s.responsible_professional_id).filter(Boolean)));
	if (distinct.length > 1) {
		throw new AgentError(
			'Os serviços escolhidos são de profissionais diferentes. Agende cada profissional separadamente.',
		);
	}
	return distinct.length === 1 ? String(distinct[0]) : null;
}

async function loadDayWindow(supabase: any, professionalId: string | null, date: string): Promise<DayWindow> {
	const weekday = weekdayOf(date);
	if (professionalId) return loadDayWindowForProfessional(supabase, professionalId, date, weekday);

	const { data: special } = await supabase
		.from('special_date_hours')
		.select('open_time, close_time, enabled')
		.eq('date', date)
		.is('professional_id', null)
		.limit(1);
	const row = special?.[0] || (await supabase
		.from('business_hours')
		.select('open_time, close_time, enabled')
		.is('professional_id', null)
		.eq('weekday', weekday)
		.limit(1)).data?.[0];
	if (!row) return { open: '09:00', close: '20:00', enabled: true };
	return {
		enabled: !!row.enabled,
		open: String(row.open_time || '09:00').slice(0, 5),
		close: String(row.close_time || '20:00').slice(0, 5),
	};
}

async function loadBookingLimitDate(supabase: any): Promise<string | null> {
	const { data } = await supabase
		.from('system_settings')
		.select('value')
		.eq('key', 'booking_limit_month')
		.maybeSingle();
	const match = /^(\d{4})-(\d{2})$/.exec(String(data?.value || ''));
	if (!match) return null;
	const lastDay = new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate();
	return `${match[1]}-${match[2]}-${String(lastDay).padStart(2, '0')}`;
}

/** Horários livres do dia, com as mesmas regras do calendário do site. */
async function computeSlots(
	supabase: any,
	opts: { date: string; durationMinutes: number; professionalId: string | null },
): Promise<{ slots: string[]; reason?: string }> {
	const { date, durationMinutes, professionalId } = opts;
	if (!isValidDate(date)) throw new AgentError('date deve estar no formato AAAA-MM-DD');

	const now = nowInSalon();
	if (date < now.date) return { slots: [], reason: 'Data no passado.' };

	const limit = await loadBookingLimitDate(supabase);
	if (limit && date > limit) {
		return { slots: [], reason: `A agenda está aberta somente até ${limit}.` };
	}

	const window = await loadDayWindow(supabase, professionalId, date);
	if (!window.enabled) return { slots: [], reason: 'Sem atendimento neste dia.' };

	let query = supabase
		.from('bookings')
		.select('time, booking_services ( quantity, services:service_id ( duration_minutes ) ), booking_cancellations ( id )')
		.eq('date', date);
	if (professionalId) query = query.eq('professional_id', professionalId);
	const { data, error } = await query;
	if (error) throw new AgentError(error.message, 500);

	const blocks = (data || [])
		.filter((b: any) => !(Array.isArray(b.booking_cancellations) && b.booking_cancellations.length > 0))
		.map((b: any) => {
			const start = toMinutes(String(b.time || '00:00:00'));
			return { start, end: start + getBookingServicesDurationMinutes(b.booking_services || []) };
		});

	const openMin = toMinutes(window.open);
	const closeMin = toMinutes(window.close);
	const duration = Math.max(1, durationMinutes || 30);
	const step = getSlotStep(duration);
	const isToday = date === now.date;

	const slots: string[] = [];
	for (let t = openMin; t + duration <= closeMin; t += step) {
		if (isToday && t <= now.minutes) continue;
		if (blocks.some((b: any) => overlaps(t, t + duration, b.start, b.end))) continue;
		slots.push(fromMinutes(t));
	}
	return slots.length ? { slots } : { slots, reason: 'Não há horários livres neste dia.' };
}

async function listUpcomingBookings(supabase: any, phone: string) {
	const clients = await findClients(supabase, phone);
	if (!clients.length) return [];

	const { data, error } = await supabase
		.from('bookings')
		.select(`
			id, date, time,
			professionals:professional_id ( name ),
			booking_services ( variant_label, services:service_id ( name ) ),
			booking_cancellations ( id )
		`)
		.in('client_id', clients.map((c) => c.id))
		.gte('date', nowInSalon().date)
		.order('date', { ascending: true })
		.order('time', { ascending: true });
	if (error) throw new AgentError(error.message, 500);

	return (data || [])
		.filter((b: any) => !(Array.isArray(b.booking_cancellations) && b.booking_cancellations.length > 0))
		.map((b: any) => ({
			booking_id: b.id,
			date: b.date,
			weekday: WEEKDAYS[weekdayOf(b.date)],
			time: String(b.time || '').slice(0, 5),
			professional: b.professionals?.name || null,
			services: (b.booking_services || [])
				.map((bs: any) => [bs?.services?.name, bs?.variant_label].filter(Boolean).join(' - '))
				.filter(Boolean),
		}));
}

// ── Memória de longo prazo ───────────────────────────────────────────
const MEMORY_TABLE = 'agent_client_memories';
const MEMORY_MAX_PER_CLIENT = 20;
const MEMORY_MAX_CHARS = 300;

function isMissingMemoryTable(message: string): boolean {
	return new RegExp(MEMORY_TABLE, 'i').test(message || '');
}

async function listMemories(supabase: any, phone: string) {
	const { data, error } = await supabase
		.from(MEMORY_TABLE)
		.select('id, content, created_at')
		.eq('phone', phone)
		.order('created_at', { ascending: true });
	if (error) {
		// Tabela ainda não criada: o agente segue funcionando, só sem memória.
		if (isMissingMemoryTable(error.message)) return [];
		throw new AgentError(error.message, 500);
	}
	return (data || []).map((m: any) => ({
		memory_id: m.id,
		content: m.content,
		saved_on: String(m.created_at || '').slice(0, 10),
	}));
}

async function actionRemember(supabase: any, body: any) {
	const phone = requirePhone(body);
	const content = String(body?.content || '').replace(/\s+/g, ' ').trim();
	if (content.length < 3) throw new AgentError('Informe content (o fato a guardar)');
	if (content.length > MEMORY_MAX_CHARS) {
		throw new AgentError(`content deve ter no máximo ${MEMORY_MAX_CHARS} caracteres. Resuma em uma frase.`);
	}

	const existing = await listMemories(supabase, phone);
	if (existing.some((m: any) => m.content.toLowerCase() === content.toLowerCase())) {
		return { memories: existing };
	}

	const { error } = await supabase.from(MEMORY_TABLE).insert({ phone, content });
	if (error) {
		if (isMissingMemoryTable(error.message)) {
			throw new AgentError('Memória indisponível: execute sql/agent-memory-schema.sql no Supabase', 500);
		}
		throw new AgentError(error.message, 500);
	}

	// Mantém só as mais recentes, para o contexto do agente não crescer sem limite.
	const overflow = existing.length + 1 - MEMORY_MAX_PER_CLIENT;
	if (overflow > 0) {
		await supabase.from(MEMORY_TABLE).delete().in('id', existing.slice(0, overflow).map((m: any) => m.memory_id));
	}
	return { memories: await listMemories(supabase, phone) };
}

async function actionForget(supabase: any, body: any) {
	const phone = requirePhone(body);
	const memoryId = String(body?.memory_id || '').trim();
	if (!memoryId) throw new AgentError('Informe memory_id');

	// O filtro por telefone impede apagar a memória de outro cliente.
	const { data, error } = await supabase
		.from(MEMORY_TABLE)
		.delete()
		.eq('id', memoryId)
		.eq('phone', phone)
		.select('id');
	if (error) throw new AgentError(error.message, 500);
	if (!data?.length) throw new AgentError('Memória não encontrada para este cliente', 404);
	return { memories: await listMemories(supabase, phone) };
}

/** Executa o handler de /api/bookings em memória, reaproveitando validações e notificações. */
function invokeBookings(req: { method: string; body: unknown; headers?: Record<string, string> }) {
	return new Promise<{ status: number; body: any }>((resolve, reject) => {
		let status = 200;
		const res: any = {
			status(code: number) { status = code; return res; },
			json(body: unknown) { resolve({ status, body }); return res; },
			setHeader() { return res; },
			end(body?: unknown) { resolve({ status, body }); return res; },
		};
		Promise.resolve(bookingsHandler({ url: '/api/bookings', headers: {}, ...req }, res)).catch(reject);
	});
}

// ── Ações ────────────────────────────────────────────────────────────
async function actionContext(supabase: any, body: any) {
	const now = nowInSalon();
	const phone = toLocalPhone(body?.phone);
	const clients = phone ? await findClients(supabase, phone) : [];
	return {
		now: { date: now.date, time: now.time, weekday: WEEKDAYS[now.weekday] },
		client: clients[0] ? { name: clients[0].name } : null,
		upcoming_bookings: phone ? await listUpcomingBookings(supabase, phone) : [],
		memories: phone ? await listMemories(supabase, phone) : [],
	};
}

async function actionCatalog(supabase: any) {
	const [servicesRes, professionalsRes, hoursRes, settingsRes] = await Promise.all([
		supabase
			.from('services')
			.select('id, name, price, duration_minutes, description, price_variation_enabled, professionals:responsible_professional_id ( id, name )')
			.order('name', { ascending: true }),
		supabase.from('professionals').select('id, name, is_active').order('name', { ascending: true }),
		supabase
			.from('business_hours')
			.select('weekday, enabled, open_time, close_time, professional_id')
			.order('weekday', { ascending: true }),
		supabase.from('system_settings').select('key, value').in('key', ['footer_address', 'booking_limit_month']),
	]);
	if (servicesRes.error) throw new AgentError(servicesRes.error.message, 500);

	const variants = await loadVariantsByServiceIds(
		supabase,
		(servicesRes.data || []).map((s: any) => Number(s.id)),
	).catch(() => new Map());

	const professionals = (professionalsRes.data || []).filter((p: any) => p.is_active !== false);
	const profName = new Map<string, string>(professionals.map((p: any) => [String(p.id), String(p.name)]));
	const settings = new Map<string, string>((settingsRes.data || []).map((r: any) => [r.key, r.value || '']));

	const hoursByScope = new Map<string, string[]>();
	for (const h of hoursRes.data || []) {
		const scope = h.professional_id ? profName.get(String(h.professional_id)) : 'geral';
		if (!scope) continue;
		const line = h.enabled
			? `${WEEKDAYS[h.weekday]}: ${String(h.open_time).slice(0, 5)}–${String(h.close_time).slice(0, 5)}`
			: `${WEEKDAYS[h.weekday]}: fechado`;
		hoursByScope.set(scope, [...(hoursByScope.get(scope) || []), line]);
	}

	return {
		services: (servicesRes.data || []).map((s: any) => {
			const sizes = s.price_variation_enabled ? variants.get(Number(s.id)) || [] : [];
			return {
				id: s.id,
				name: s.name,
				price: Number(s.price),
				duration_minutes: Number(s.duration_minutes),
				description: s.description || undefined,
				professional: s.professionals?.name || null,
				// Quando presente, o preço depende do tamanho do cabelo (hair_size obrigatório ao agendar).
				hair_size_prices: sizes.length
					? Object.fromEntries(sizes.map((v: any) => [v.variantKey, Number(v.price)]))
					: undefined,
			};
		}),
		professionals: professionals.map((p: any) => ({ id: p.id, name: p.name })),
		business_hours: Object.fromEntries(hoursByScope),
		address: settings.get('footer_address') || null,
		booking_limit_month: settings.get('booking_limit_month') || null,
	};
}

async function actionSlots(supabase: any, body: any) {
	const services = await loadServices(supabase, parseServiceIds(body?.service_ids));
	const professionalId = resolveProfessionalId(services, body?.professional_id);
	const durationMinutes = services.reduce((sum, s) => sum + Number(s.duration_minutes || 0), 0) || 30;
	const date = String(body?.date || '').trim();
	const result = await computeSlots(supabase, { date, durationMinutes, professionalId });
	return { date, weekday: isValidDate(date) ? WEEKDAYS[weekdayOf(date)] : null, duration_minutes: durationMinutes, ...result };
}

async function actionBook(supabase: any, body: any) {
	const phone = requirePhone(body);
	const name = String(body?.name || '').trim();
	if (name.length < 2) throw new AgentError('Informe o nome do cliente (name)');

	const date = String(body?.date || '').trim();
	const time = String(body?.time || '').trim().slice(0, 5);
	if (!/^\d{2}:\d{2}$/.test(time)) throw new AgentError('time deve estar no formato HH:MM');

	const services = await loadServices(supabase, parseServiceIds(body?.service_ids));
	const professionalId = resolveProfessionalId(services, body?.professional_id);
	const durationMinutes = services.reduce((sum, s) => sum + Number(s.duration_minutes || 0), 0) || 30;

	const hairSize = String(body?.hair_size || '').trim().toLowerCase();
	const needsHairSize = services.some((s) => s.price_variation_enabled);
	if (needsHairSize && !HAIR_SIZE_VARIANT_DEFS.some((v) => v.key === hairSize)) {
		throw new AgentError('Este serviço varia pelo tamanho do cabelo. Informe hair_size: small, medium ou large.');
	}

	// POST /api/bookings só verifica conflito; expediente, passado e limite da agenda são checados aqui.
	const { slots, reason } = await computeSlots(supabase, { date, durationMinutes, professionalId });
	if (!slots.includes(time)) {
		throw new AgentError(reason || `O horário ${time} não está disponível em ${date}.`, 409, { available_slots: slots });
	}

	// Reaproveita o cadastro existente para não duplicar o cliente nem apagar e-mail/observações.
	const existing = (await findClients(supabase, phone))[0];
	const { status, body: result } = await invokeBookings({
		method: 'POST',
		body: {
			date,
			time,
			professional_id: professionalId,
			client: {
				name,
				phone: existing?.phone || phone,
				email: existing?.email || undefined,
				notes: existing?.notes ?? null,
			},
			services: services.map((s) => ({
				id: Number(s.id),
				quantity: 1,
				variant_key: s.price_variation_enabled ? hairSize : undefined,
			})),
		},
	});
	if (status >= 400 || !result?.ok) {
		throw new AgentError(result?.error || 'Não foi possível criar o agendamento', status >= 400 ? status : 500);
	}
	return {
		booking_id: result.booking_id,
		date,
		time,
		services: services.map((s) => s.name),
		message: 'Solicitação registrada. O cliente já recebeu a mensagem automática; o salão ainda vai confirmar o horário.',
	};
}

async function actionCancel(supabase: any, body: any) {
	const phone = requirePhone(body);
	const bookingId = String(body?.booking_id || '').trim();
	if (!bookingId) throw new AgentError('Informe booking_id');

	const upcoming = await listUpcomingBookings(supabase, phone);
	const booking = upcoming.find((b: any) => String(b.booking_id) === bookingId);
	if (!booking) {
		throw new AgentError('Agendamento não encontrado entre os próximos agendamentos deste cliente.', 404);
	}

	const { data: row } = await supabase.from('bookings').select('client_id').eq('id', bookingId).single();
	const clientId = String(row?.client_id || '');
	if (!clientId) throw new AgentError('Agendamento não encontrado', 404);

	// O cancelamento pelo cliente em /api/bookings exige sessão de cliente dona do agendamento.
	const { token } = createSessionToken({ role: 'client', sub: clientId, phone });
	const { status, body: result } = await invokeBookings({
		method: 'PUT',
		headers: { authorization: `Bearer ${token}` },
		body: { booking_id: bookingId, status: 'cancelled', cancelled_by: 'client' },
	});
	if (status >= 400 || !result?.ok) {
		throw new AgentError(result?.error || 'Não foi possível cancelar', status >= 400 ? status : 500);
	}
	return { cancelled: booking };
}

async function readJsonBody(req: any): Promise<any> {
	if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
	let raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : typeof req.body === 'string' ? req.body : '';
	if (!raw) {
		const chunks: Buffer[] = [];
		for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		raw = Buffer.concat(chunks).toString('utf8');
	}
	if (!raw) return {};
	try {
		return JSON.parse(raw);
	} catch {
		throw new AgentError('JSON inválido no corpo');
	}
}

export async function handleAgentRequest(req: any, res: any, action: string) {
	try {
		const expected = (process.env.AGENT_API_KEY || '').trim();
		if (expected.length < 24) {
			// Fail-closed: sem chave configurada, nenhuma ferramenta responde.
			throw new AgentError('AGENT_API_KEY não configurada no servidor (mínimo 24 caracteres)', 500);
		}
		const received = String(req.headers?.['x-agent-key'] || '').trim();
		if (!received || !safeEqual(received, expected)) throw new AgentError('Não autorizado', 401);
		if (req.method !== 'POST') throw new AgentError('Use POST', 405);

		const body = await readJsonBody(req);
		const supabase = getSupabase();

		let result: Record<string, unknown>;
		switch (action) {
			case 'context': result = await actionContext(supabase, body); break;
			case 'catalog': result = await actionCatalog(supabase); break;
			case 'slots': result = await actionSlots(supabase, body); break;
			case 'book': result = await actionBook(supabase, body); break;
			case 'bookings': result = { bookings: await listUpcomingBookings(supabase, requirePhone(body)) }; break;
			case 'cancel': result = await actionCancel(supabase, body); break;
			case 'remember': result = await actionRemember(supabase, body); break;
			case 'forget': result = await actionForget(supabase, body); break;
			default: throw new AgentError(`Ação desconhecida: ${action}`, 404);
		}
		return res.status(200).json({ ok: true, ...result });
	} catch (err: any) {
		const status = err instanceof AgentError ? err.status : 500;
		if (status >= 500) console.error(`[agent-tools] ${action}:`, err?.message || err);
		return res.status(status).json({ ok: false, error: err?.message || 'Erro inesperado', ...(err?.extra || {}) });
	}
}
