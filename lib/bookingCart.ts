import { BookingCartItem } from '../types';
import { overlaps, toMinutes } from './timeSlots';

export function formatDateYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function blockFromCartItem(item: BookingCartItem) {
  const start = toMinutes(item.time);
  return {
    start,
    end: start + item.service.duration,
    professionalId: item.professionalId,
    date: formatDateYmd(item.date),
    cartId: item.id,
  };
}

/** Verifica conflito do rascunho com itens já no carrinho (mesmo profissional e data). */
export function conflictsWithCart(
  cartItems: BookingCartItem[],
  date: Date,
  time: string,
  durationMinutes: number,
  professionalId: string | null,
  excludeCartId?: string,
): boolean {
  const dateStr = formatDateYmd(date);
  const start = toMinutes(time);
  const end = start + durationMinutes;

  return cartItems
    .filter((item) => item.id !== excludeCartId)
    .some((item) => {
      if (formatDateYmd(item.date) !== dateStr) return false;
      const profA = professionalId || null;
      const profB = item.professionalId || null;
      if (profA && profB && profA !== profB) return false;
      const block = blockFromCartItem(item);
      return overlaps(start, end, block.start, block.end);
    });
}

export async function validateSlotOnServer(
  date: string,
  time: string,
  serviceId: number,
  professionalId: string | null,
): Promise<{ available: boolean; error?: string }> {
  const qs = new URLSearchParams({
    validate_slot: '1',
    date,
    time: time.length === 5 ? time : time.slice(0, 5),
    service_id: String(serviceId),
  });
  if (professionalId) qs.set('professional_id', professionalId);
  const res = await fetch(`/api/bookings?${qs.toString()}`);
  const data = await res.json();
  if (!res.ok) return { available: false, error: data?.error || 'Erro ao validar horário' };
  return { available: !!data.available, error: data.error };
}
