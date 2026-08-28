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

export function getSlotStep(serviceDuration: number): number {
	const duration = Math.max(30, serviceDuration || 30);
	if (duration % 30 === 0) return 30;
	if (duration % 15 === 0) return 15;
	return duration;
}

export function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
	return startA < endB && endA > startB;
}

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
