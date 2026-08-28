import React, { useEffect, useMemo, useState } from 'react';
import { Promotion } from '../types';
import { groupSlotsByPeriod } from '../lib/timeSlots';

interface PromotionDateTimePickerProps {
  promotion: Promotion;
  onBack: () => void;
  onDateTimeSelect: (date: Date, time: string) => void;
}

const Calendar: React.FC<{
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  maxDate?: Date | null;
  isDayEnabled?: (date: Date) => boolean;
}> = ({ selectedDate, onDateSelect, maxDate, isDayEnabled }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startDate = new Date(startOfMonth);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  const days: Date[] = [];
  let day = new Date(startDate);
  while (day <= endOfMonth || days.length % 7 !== 0) {
    days.push(new Date(day));
    day.setDate(day.getDate() + 1);
  }
  const isToday = (date: Date) => new Date().toDateString() === date.toDateString();
  const isSelected = (date: Date) => selectedDate.toDateString() === date.toDateString();
  const isPast = (date: Date) => date < new Date() && !isToday(date);
  const isDisabled = (date: Date) => {
    if (isPast(date)) return true;
    if (maxDate && date > maxDate) return true;
    if (isDayEnabled && !isDayEnabled(date)) return true;
    return false;
  };

  return (
    <div className="bg-surface-raised p-4 rounded-lg border border-line shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <button type="button" onClick={() => setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))} className="p-2 rounded-full hover:bg-surface-muted text-zinc-200">◀</button>
        <h3 className="font-bold text-lg text-white">{currentMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
        <button type="button" onClick={() => setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))} className="p-2 rounded-full hover:bg-surface-muted text-zinc-200">▶</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm text-zinc-300 mb-2 font-semibold">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const disabled = isDisabled(d);
          return (
            <button
              key={i}
              type="button"
              onClick={() => { if (!disabled) onDateSelect(d); }}
              disabled={disabled}
              className={`w-10 h-10 rounded-full transition-colors ${disabled ? 'text-zinc-500 opacity-50' : 'hover:bg-gold text-white'} ${d.getMonth() !== currentMonth.getMonth() ? 'text-zinc-400' : ''} ${isSelected(d) ? 'bg-gold font-bold' : ''}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const PromotionDateTimePicker: React.FC<PromotionDateTimePickerProps> = ({ promotion, onBack, onDateTimeSelect }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [maxDate, setMaxDate] = useState<Date | null>(null);
  const [businessHours, setBusinessHours] = useState<Array<{ weekday: number; enabled: boolean }>>([]);

  const formatDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const totalDuration = useMemo(() => {
    return promotion.items.reduce((sum, item) => sum + (item.serviceDuration || 30), 0)
      + Number(promotion.gapMinutes || 0) * Math.max(promotion.items.length - 1, 0);
  }, [promotion]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/schedule-settings');
        const data = await res.json();
        if (res.ok) {
          if (data?.booking_limit_month) {
            const [y, m] = String(data.booking_limit_month).split('-').map(Number);
            if (y && m) setMaxDate(new Date(y, m, 0));
          }
          setBusinessHours((data?.business_hours || []).map((h: any) => ({
            weekday: Number(h.weekday),
            enabled: !!h.enabled,
          })));
        }
      } catch { /* silencioso */ }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingSlots(true);
      setSelectedTime(null);
      try {
        const date = formatDateStr(selectedDate);
        const qs = new URLSearchParams({ promotion_slots: '1', promotion_id: promotion.id, date });
        const res = await fetch(`/api/bookings?${qs.toString()}`);
        const data = await res.json();
        setSlots(res.ok ? (data.slots || []) : []);
      } catch {
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    })();
  }, [selectedDate, promotion.id]);

  const groupedSlots = useMemo(() => groupSlotsByPeriod(slots, '09:00', '20:00'), [slots]);

  const isDayEnabled = (date: Date) => {
    const dateStr = formatDateStr(date);
    if (promotion.kind === 'temporary') {
      if (promotion.validFrom && dateStr < promotion.validFrom) return false;
      if (promotion.validUntil && dateStr > promotion.validUntil) return false;
    }
    const weekday = date.getDay();
    const hourConfig = businessHours.find((h) => h.weekday === weekday);
    if (!hourConfig) return true;
    return hourConfig.enabled;
  };

  return (
    <div className="max-w-4xl mx-auto bg-surface-raised p-6 md:p-8 rounded-2xl border border-line shadow-xl">
      <h2 className="text-2xl font-bold gold-text mb-2">Promoção: {promotion.name}</h2>
      <p className="text-sm text-zinc-400 mb-4">{promotion.description}</p>
      <ol className="text-sm text-zinc-300 mb-6 list-decimal list-inside space-y-1">
        {promotion.items.map((item) => (
          <li key={item.sortOrder}>
            {item.serviceName} ({item.serviceDuration || 30} min) — {item.professionalName}
            {item.pricePercent > 0 && (
              <span className="text-zinc-500"> · {item.pricePercent}% (R$ {((promotion.totalPrice * item.pricePercent) / 100).toFixed(2)})</span>
            )}
          </li>
        ))}
      </ol>
      <p className="text-xs text-zinc-500 mb-4">Duração total estimada: {totalDuration} min · Valor: R$ {promotion.totalPrice.toFixed(2)}</p>

      <div className="grid md:grid-cols-2 gap-8">
        <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} maxDate={maxDate} isDayEnabled={isDayEnabled} />
        <div className="max-h-[400px] overflow-y-auto pr-2">
          <h3 className="font-bold text-lg mb-4 text-white">Horários disponíveis para {selectedDate.toLocaleDateString('pt-BR')}</h3>
          {loadingSlots ? (
            <p className="text-zinc-400 text-sm">Calculando horários da sequência...</p>
          ) : slots.length === 0 ? (
            <p className="text-zinc-400 text-sm">Nenhum horário disponível neste dia para executar todos os serviços em sequência.</p>
          ) : (
            Object.entries(groupedSlots).map(([period, periodSlots]) => (
              Array.isArray(periodSlots) && periodSlots.length > 0 && (
                <div key={period} className="mb-4">
                  <h4 className="font-semibold text-gold mb-2 capitalize">{period === 'morning' ? 'Manhã' : period === 'afternoon' ? 'Tarde' : 'Noite'}</h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {periodSlots.map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setSelectedTime(time)}
                        className={`p-2 rounded-lg border-2 text-white ${selectedTime === time ? 'bg-gold border-gold font-bold' : 'bg-surface-overlay border-line hover:border-gold'}`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              )
            ))
          )}
        </div>
      </div>

      <div className="flex justify-between mt-8 border-t border-line pt-6">
        <button type="button" onClick={onBack} className="bg-surface-muted text-white font-bold py-3 px-6 rounded-lg">Voltar</button>
        <button
          type="button"
          onClick={() => { if (selectedTime) onDateTimeSelect(selectedDate, selectedTime); }}
          disabled={!selectedTime}
          className="bg-gold text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50"
        >
          Próximo
        </button>
      </div>
    </div>
  );
};

export default PromotionDateTimePicker;
