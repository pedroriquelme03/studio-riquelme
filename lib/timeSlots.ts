export type DayWindow = { open: string; close: string; enabled: boolean };

export function toMinutes(time: string): number {
	const [h, m] = String(time || '00:00').slice(0, 5).split(':').map(Number);
	return (h || 0) * 60 + (m || 0);
}

export function fromMinutes(total: number): string {
	const h = Math.floor(total / 60);
	const m = total % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
	return startA < endB && endA > startB;
}

/** Soma a duração real dos serviços de um agendamento (em minutos). */
export function getBookingServicesDurationMinutes(bookingServices: any[]): number {
	const total = (bookingServices || []).reduce((sum: number, bs: any) => {
		const svc = bs?.services;
		if (Array.isArray(svc)) {
			const lineDuration = svc.reduce(
				(lineSum: number, row: any) => lineSum + Number(row?.duration_minutes || 0),
				0,
			);
			return sum + lineDuration * Number(bs?.quantity ?? 1);
		}
		return sum + Number(svc?.duration_minutes || 0) * Number(bs?.quantity ?? 1);
	}, 0);
	return total > 0 ? total : 30;
}

export function getSlotStep(serviceDuration: number): number {
	const duration = Math.max(30, serviceDuration || 30);
	if (duration % 30 === 0) return 30;
	if (duration % 15 === 0) return 15;
	return duration;
}

export function buildAvailableTimeSlots(
	serviceDuration: number,
	window: DayWindow,
	bookings: Array<{ time: string; duration: number }>,
	selectedDate: Date,
) {
	const defaultWindow: DayWindow = { open: '09:00', close: '20:00', enabled: true };
	const w = window?.enabled ? window : defaultWindow;
	const openMin = toMinutes(w.open);
	const closeMin = toMinutes(w.close);
	const duration = Math.max(1, serviceDuration || 30);
	const step = getSlotStep(duration);

	const blocks = (bookings || []).map((b) => {
		const start = toMinutes(b.time);
		const blockDuration = Number(b.duration) > 0 ? Number(b.duration) : 30;
		return { start, end: start + blockDuration };
	});

	const slots: string[] = [];
	const now = new Date();
	const isToday = selectedDate.toDateString() === now.toDateString();
	const nowMin = now.getHours() * 60 + now.getMinutes();

	for (let t = openMin; t + duration <= closeMin; t += step) {
		if (isToday && t <= nowMin) continue;

		const slotStart = t;
		const slotEnd = t + duration;
		const clashes = blocks.some((b) => overlaps(slotStart, slotEnd, b.start, b.end));
		if (clashes) continue;

		slots.push(fromMinutes(t));
	}

	return groupSlotsByPeriod(slots, w.open, w.close);
}

/** Agrupa slots por período usando minutos (não só a hora inteira). */
export function groupSlotsByPeriod(slots: string[], open: string, close: string) {
	const openMin = toMinutes(open);
	const closeMin = toMinutes(close);
	const noon = 12 * 60;
	const eveningStart = 18 * 60;

	const morning = slots.filter((time) => {
		const m = toMinutes(time);
		return m >= openMin && m < Math.min(noon, closeMin);
	});
	const afternoon = slots.filter((time) => {
		const m = toMinutes(time);
		return m >= Math.max(noon, openMin) && m < Math.min(eveningStart, closeMin);
	});
	const evening = slots.filter((time) => {
		const m = toMinutes(time);
		return m >= Math.max(eveningStart, openMin) && m < closeMin;
	});

	return { morning, afternoon, evening };
}
