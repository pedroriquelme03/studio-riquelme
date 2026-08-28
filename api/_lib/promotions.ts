import type { SupabaseClient } from '@supabase/supabase-js';
import { fromMinutes, getSlotStep, overlaps, toMinutes } from './time-slots.js';

export type PromotionKind = 'fixed' | 'temporary';

export type PromotionItemRow = {
	id: string;
	promotion_id: string;
	service_id: number;
	professional_id: string;
	sort_order: number;
	price_percent: number;
	services?: { id: number; name: string; duration_minutes: number } | Array<{ id: number; name: string; duration_minutes: number }>;
	professionals?: { id: string; name: string } | null;
};

export type PromotionRow = {
	id: string;
	name: string;
	description: string | null;
	kind: PromotionKind;
	total_price: number;
	valid_from: string | null;
	valid_until: string | null;
	gap_minutes: number;
	is_active: boolean;
	items?: PromotionItemRow[];
};

export type PromotionSegment = {
	professionalId: string;
	serviceId: number;
	sortOrder: number;
	startMinutes: number;
	endMinutes: number;
	durationMinutes: number;
	allocatedPrice: number;
	time: string;
};

export type DayWindow = { open: string; close: string; enabled: boolean };

function isMissingTableError(message: string | undefined) {
	return /relation|does not exist|schema cache/i.test(message || '');
}

function normalizeKind(raw: unknown): PromotionKind {
	return String(raw || 'temporary').toLowerCase() === 'fixed' ? 'fixed' : 'temporary';
}

function serviceDuration(item: PromotionItemRow): number {
	const svc = item.services;
	if (Array.isArray(svc)) return Number(svc[0]?.duration_minutes || 0) || 30;
	return Number((svc as any)?.duration_minutes || 0) || 30;
}

export function normalizePromotionItems(items: PromotionItemRow[]): PromotionItemRow[] {
	return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

export function validatePromotionItemsPercent(items: Array<{ price_percent?: number; pricePercent?: number }>): string | null {
	if (!items.length) return 'A promoção precisa de pelo menos um serviço';
	const sum = items.reduce((acc, item) => acc + Number(item.price_percent ?? item.pricePercent ?? 0), 0);
	if (Math.abs(sum - 100) > 0.01) {
		return `A soma das porcentagens deve ser 100% (atual: ${sum.toFixed(2)}%)`;
	}
	return null;
}

export function isPromotionValidOnDate(promotion: PromotionRow, date: string): boolean {
	if (promotion.is_active === false) return false;
	if (promotion.kind === 'fixed') return true;
	const from = promotion.valid_from ? String(promotion.valid_from).slice(0, 10) : null;
	const until = promotion.valid_until ? String(promotion.valid_until).slice(0, 10) : null;
	if (from && date < from) return false;
	if (until && date > until) return false;
	return true;
}

export function buildPromotionSegments(
	items: PromotionItemRow[],
	totalPrice: number,
	gapMinutes: number,
	startTime: string,
): PromotionSegment[] {
	const sorted = normalizePromotionItems(items);
	let cursor = toMinutes(startTime);
	const segments: PromotionSegment[] = [];

	for (let i = 0; i < sorted.length; i++) {
		const item = sorted[i];
		const duration = serviceDuration(item);
		const start = cursor;
		const end = start + duration;
		segments.push({
			professionalId: String(item.professional_id),
			serviceId: Number(item.service_id),
			sortOrder: Number(item.sort_order),
			startMinutes: start,
			endMinutes: end,
			durationMinutes: duration,
			allocatedPrice: Math.round(totalPrice * (Number(item.price_percent) / 100) * 100) / 100,
			time: `${fromMinutes(start)}:00`,
		});
		if (i < sorted.length - 1) cursor = end + Number(gapMinutes || 0);
		else cursor = end;
	}

	return segments;
}

export async function loadPromotionWithItems(
	supabase: SupabaseClient,
	promotionId: string,
): Promise<PromotionRow | null> {
	const { data, error } = await supabase
		.from('promotions')
		.select(`
			id, name, description, kind, total_price, valid_from, valid_until, gap_minutes, is_active,
			items:promotion_items (
				id, promotion_id, service_id, professional_id, sort_order, price_percent,
				services:service_id ( id, name, duration_minutes ),
				professionals:professional_id ( id, name )
			)
		`)
		.eq('id', promotionId)
		.single();

	if (error) {
		if (isMissingTableError(error.message)) return null;
		throw new Error(error.message);
	}
	return data as PromotionRow;
}

async function loadDayWindowForProfessional(
	supabase: SupabaseClient,
	professionalId: string,
	date: string,
	weekday: number,
): Promise<DayWindow> {
	const { data: specialRows } = await supabase
		.from('special_date_hours')
		.select('date, open_time, close_time, enabled, professional_id')
		.eq('date', date);

	const specials = specialRows || [];
	const special =
		specials.find((s: any) => s.professional_id === professionalId)
		|| specials.find((s: any) => !s.professional_id);

	if (special) {
		return {
			enabled: !!special.enabled,
			open: String(special.open_time || '09:00').slice(0, 5),
			close: String(special.close_time || '20:00').slice(0, 5),
		};
	}

	const { data: profHours } = await supabase
		.from('business_hours')
		.select('weekday, enabled, open_time, close_time')
		.eq('professional_id', professionalId)
		.eq('weekday', weekday)
		.limit(1);

	if (profHours?.[0]) {
		const h = profHours[0] as any;
		return {
			enabled: !!h.enabled,
			open: String(h.open_time || '09:00').slice(0, 5),
			close: String(h.close_time || '20:00').slice(0, 5),
		};
	}

	const { data: globalHours } = await supabase
		.from('business_hours')
		.select('weekday, enabled, open_time, close_time')
		.is('professional_id', null)
		.eq('weekday', weekday)
		.limit(1);

	if (globalHours?.[0]) {
		const h = globalHours[0] as any;
		return {
			enabled: !!h.enabled,
			open: String(h.open_time || '09:00').slice(0, 5),
			close: String(h.close_time || '20:00').slice(0, 5),
		};
	}

	return { open: '09:00', close: '20:00', enabled: true };
}

type BookedBlock = { start: number; end: number };

async function loadBookedBlocksForProfessional(
	supabase: SupabaseClient,
	date: string,
	professionalId: string,
	excludeBookingIds: string[] = [],
): Promise<BookedBlock[]> {
	let query = supabase
		.from('bookings')
		.select(`
			id,
			time,
			booking_services ( quantity, services:service_id ( duration_minutes ) ),
			booking_cancellations ( id )
		`)
		.eq('date', date)
		.eq('professional_id', professionalId);

	const { data, error } = await query;
	if (error) throw new Error(error.message);

	return (data || [])
		.filter((b: any) => !(Array.isArray(b.booking_cancellations) && b.booking_cancellations.length > 0))
		.filter((b: any) => !excludeBookingIds.includes(String(b.id)))
		.map((b: any) => {
			const start = toMinutes(String(b.time || '00:00:00'));
			const duration = (b.booking_services || []).reduce((sum: number, bs: any) => {
				const svc = bs?.services;
				const d = Array.isArray(svc) ? Number(svc[0]?.duration_minutes || 0) : Number(svc?.duration_minutes || 0);
				return sum + d * Number(bs?.quantity ?? 1);
			}, 0) || 30;
			return { start, end: start + duration };
		});
}

export function segmentFitsSchedule(
	segment: PromotionSegment,
	window: DayWindow,
	blocks: BookedBlock[],
): boolean {
	if (!window.enabled) return false;
	const openMin = toMinutes(window.open);
	const closeMin = toMinutes(window.close);
	if (segment.startMinutes < openMin || segment.endMinutes > closeMin) return false;
	return !blocks.some((b) => overlaps(segment.startMinutes, segment.endMinutes, b.start, b.end));
}

export async function validatePromotionSequence(
	supabase: SupabaseClient,
	date: string,
	segments: PromotionSegment[],
	excludeBookingIds: string[] = [],
): Promise<string | null> {
	const weekday = new Date(`${date}T12:00:00`).getDay();
	const profIds = Array.from(new Set(segments.map((s) => s.professionalId)));
	const windows = new Map<string, DayWindow>();
	const blocksByProf = new Map<string, BookedBlock[]>();

	for (const profId of profIds) {
		windows.set(profId, await loadDayWindowForProfessional(supabase, profId, date, weekday));
		blocksByProf.set(profId, await loadBookedBlocksForProfessional(supabase, date, profId, excludeBookingIds));
	}

	for (const segment of segments) {
		const window = windows.get(segment.professionalId)!;
		const blocks = blocksByProf.get(segment.professionalId)!;
		if (!segmentFitsSchedule(segment, window, blocks)) {
			return `Indisponível para ${fromMinutes(segment.startMinutes)} no serviço #${segment.sortOrder}`;
		}
	}
	return null;
}

export async function getPromotionAvailableSlots(
	supabase: SupabaseClient,
	promotion: PromotionRow,
	date: string,
	excludeBookingIds: string[] = [],
): Promise<string[]> {
	if (!isPromotionValidOnDate(promotion, date)) return [];
	const items = normalizePromotionItems(promotion.items || []);
	if (!items.length) return [];

	const totalDuration = items.reduce((sum, item) => sum + serviceDuration(item), 0)
		+ Number(promotion.gap_minutes || 0) * Math.max(items.length - 1, 0);
	const step = getSlotStep(totalDuration);

	const weekday = new Date(`${date}T12:00:00`).getDay();
	const profIds = Array.from(new Set(items.map((i) => String(i.professional_id))));
	const windows = new Map<string, DayWindow>();
	for (const profId of profIds) {
		windows.set(profId, await loadDayWindowForProfessional(supabase, profId, date, weekday));
	}

	const enabledWindows = profIds.map((id) => windows.get(id)!);
	if (enabledWindows.some((w) => !w.enabled)) return [];

	const openMin = Math.max(...enabledWindows.map((w) => toMinutes(w.open)));
	const closeMin = Math.min(...enabledWindows.map((w) => toMinutes(w.close)));
	if (closeMin <= openMin) return [];

	const now = new Date();
	const isToday = now.toISOString().slice(0, 10) === date;
	const nowMin = now.getHours() * 60 + now.getMinutes();

	const slots: string[] = [];
	for (let t = openMin; t + totalDuration <= closeMin; t += step) {
		if (isToday && t <= nowMin) continue;
		const startTime = `${fromMinutes(t)}:00`;
		const segments = buildPromotionSegments(items, Number(promotion.total_price), Number(promotion.gap_minutes || 0), startTime);
		const conflict = await validatePromotionSequence(supabase, date, segments, excludeBookingIds);
		if (!conflict) slots.push(fromMinutes(t));
	}
	return slots;
}

export async function getPromotionGroupBookingIds(
	supabase: SupabaseClient,
	bookingId: string,
): Promise<{ groupId: string | null; bookingIds: string[] }> {
	const { data, error } = await supabase
		.from('bookings')
		.select('id, promotion_group_id')
		.eq('id', bookingId)
		.single();
	if (error || !data) return { groupId: null, bookingIds: [bookingId] };

	const groupId = (data as any).promotion_group_id ? String((data as any).promotion_group_id) : null;
	if (!groupId) return { groupId: null, bookingIds: [bookingId] };

	const { data: siblings } = await supabase
		.from('bookings')
		.select('id')
		.eq('promotion_group_id', groupId);

	return {
		groupId,
		bookingIds: (siblings || []).map((r: any) => String(r.id)),
	};
}

export { normalizeKind, isMissingTableError };
