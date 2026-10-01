// Regras de agenda compartilhadas entre o site (POST /api/bookings) e o agente de WhatsApp.
// Mantido em _lib/ para não contar como Serverless Function no Vercel Hobby.

import { loadDayWindowForProfessional } from './promotions.js';
import { toMinutes, type DayWindow } from './time-slots.js';

const TIME_ZONE = 'America/Sao_Paulo';

/** Data, hora e dia da semana no fuso do salão (a Vercel roda em UTC). */
export function nowInSalon(): { date: string; time: string; minutes: number; weekday: number } {
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

export function weekdayOf(date: string): number {
	return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function isValidDate(date: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
	const d = new Date(`${date}T12:00:00Z`);
	return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/** Expediente do dia: horário especial da data, senão o do profissional, senão o geral. */
export async function loadDayWindow(supabase: any, professionalId: string | null, date: string): Promise<DayWindow> {
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

export async function loadBookingLimitDate(supabase: any): Promise<string | null> {
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

/**
 * Confere se o horário pedido respeita as regras da agenda. Devolve a mensagem
 * de erro, ou null se estiver tudo certo.
 *
 * `enforceWindow: false` é para o profissional logado, que pode encaixar um
 * atendimento fora do expediente; data no passado é recusada para todos.
 */
export async function checkScheduleRules(
	supabase: any,
	opts: {
		date: string;
		time: string;
		professionalId: string | null;
		durationMinutes: number;
		enforceWindow: boolean;
	},
): Promise<string | null> {
	const now = nowInSalon();
	const start = toMinutes(opts.time);

	if (opts.date < now.date) return 'Não é possível agendar em uma data que já passou.';
	if (!opts.enforceWindow) return null;
	if (opts.date === now.date && start <= now.minutes) return 'Este horário já passou.';

	const limit = await loadBookingLimitDate(supabase);
	if (limit && opts.date > limit) return 'A agenda ainda não está aberta para esta data.';

	const window = await loadDayWindow(supabase, opts.professionalId, opts.date);
	if (!window.enabled) return 'Não há atendimento neste dia.';
	if (start < toMinutes(window.open) || start + opts.durationMinutes > toMinutes(window.close)) {
		return `Horário fora do expediente (${window.open} às ${window.close}).`;
	}
	return null;
}
