import type { SupabaseClient } from '@supabase/supabase-js';
import { getBookingServicesDurationMinutes, overlaps, toMinutes } from './time-slots.js';

export type BookingSlotCheck = {
	date: string;
	time: string;
	professionalId?: string | null;
	durationMinutes: number;
	excludeBookingId?: string;
};

export async function findBookingSlotConflict(
	supabase: SupabaseClient,
	slot: BookingSlotCheck,
): Promise<string | null> {
	const time = slot.time.length === 5 ? `${slot.time}:00` : slot.time;
	const newStart = toMinutes(time);
	const newEnd = newStart + slot.durationMinutes;

	let query = supabase
		.from('bookings')
		.select(`
			id,
			time,
			professional_id,
			booking_services ( quantity, services:service_id ( duration_minutes ) ),
			booking_cancellations ( id )
		`)
		.eq('date', slot.date);

	if (slot.professionalId) {
		query = query.eq('professional_id', slot.professionalId);
	}

	if (slot.excludeBookingId) {
		query = query.neq('id', slot.excludeBookingId);
	}

	const { data, error } = await query;
	if (error) throw new Error(error.message);

	for (const booking of data || []) {
		if (Array.isArray((booking as any).booking_cancellations) && (booking as any).booking_cancellations.length > 0) {
			continue;
		}

		const existingStart = toMinutes(String((booking as any).time || '00:00:00'));
		const existingDuration = getBookingServicesDurationMinutes((booking as any).booking_services || []);
		const existingEnd = existingStart + existingDuration;

		if (overlaps(newStart, newEnd, existingStart, existingEnd)) {
			const hh = String(Math.floor(existingStart / 60)).padStart(2, '0');
			const mm = String(existingStart % 60).padStart(2, '0');
			return `Horário indisponível: já existe agendamento às ${hh}:${mm}.`;
		}
	}

	return null;
}

export async function assertBookingSlotAvailable(
	supabase: SupabaseClient,
	slot: BookingSlotCheck,
): Promise<void> {
	const conflict = await findBookingSlotConflict(supabase, slot);
	if (conflict) {
		const err = new Error(conflict);
		(err as any).code = 'SLOT_UNAVAILABLE';
		throw err;
	}
}

export async function getBookingDurationForId(
	supabase: SupabaseClient,
	bookingId: string,
): Promise<{ durationMinutes: number; professionalId: string | null }> {
	const { data, error } = await supabase
		.from('bookings')
		.select(`
			professional_id,
			booking_services ( quantity, services:service_id ( duration_minutes ) )
		`)
		.eq('id', bookingId)
		.single();

	if (error || !data) {
		throw new Error('Agendamento não encontrado');
	}

	return {
		durationMinutes: getBookingServicesDurationMinutes((data as any).booking_services || []),
		professionalId: (data as any).professional_id ?? null,
	};
}

export async function getServicesDurationMinutes(
	supabase: SupabaseClient,
	services: Array<{ id: number; quantity?: number }>,
): Promise<number> {
	if (!services.length) return 30;

	const serviceIds = services.map((s) => s.id);
	const { data, error } = await supabase
		.from('services')
		.select('id, duration_minutes')
		.in('id', serviceIds);

	if (error) throw new Error(error.message);

	const durationById = new Map<number, number>(
		(data || []).map((row: any) => [Number(row.id), Number(row.duration_minutes || 0)]),
	);

	const total = services.reduce((sum, s) => {
		const duration = durationById.get(Number(s.id)) || 0;
		return sum + duration * Number(s.quantity ?? 1);
	}, 0);

	return total > 0 ? total : 30;
}
