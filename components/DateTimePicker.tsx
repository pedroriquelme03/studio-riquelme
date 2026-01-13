import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

interface DateTimePickerProps {
  onBack: () => void;
  onDateTimeSelect: (date: Date, time: string) => void;
  serviceDuration: number;
}

const Calendar: React.FC<{ selectedDate: Date; onDateSelect: (date: Date) => void; maxDate?: Date | null }> = ({ selectedDate, onDateSelect, maxDate }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startDate = new Date(startOfMonth);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const days = [];
  let day = new Date(startDate);
  while (day <= endOfMonth || days.length % 7 !== 0) {
    days.push(new Date(day));
    day.setDate(day.getDate() + 1);
  }

  const isToday = (date: Date) => new Date().toDateString() === date.toDateString();
  const isSelected = (date: Date) => selectedDate.toDateString() === date.toDateString();
  const isPast = (date: Date) => date < new Date() && !isToday(date);

  const changeMonth = (amount: number) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + amount);
      // clamp to maxDate month if needed
      if (maxDate) {
        const limit = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
        if (newDate > limit) return limit;
      }
      return newDate;
    });
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-100 text-gray-700"><ChevronLeftIcon className="w-5 h-5" /></button>
        <h3 className="font-bold text-lg text-gray-900">{currentMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
        <button
          onClick={() => changeMonth(1)}
          disabled={!!maxDate && new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1) > new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm text-gray-600 mb-2 font-semibold">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <button
            key={i}
            onClick={() => {
              if (isPast(d)) return;
              if (maxDate && d > maxDate) return;
              onDateSelect(d);
            }}
            disabled={isPast(d) || (maxDate ? d > maxDate : false)}
            className={`w-10 h-10 rounded-full transition-colors duration-200
              ${isPast(d) || (maxDate && d > maxDate) ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-pink-600 hover:text-white'}
              ${d.getMonth() !== currentMonth.getMonth() ? 'text-gray-400' : 'text-gray-900'}
              ${isToday(d) && !isSelected(d) ? 'border-2 border-pink-600' : ''}
              ${isSelected(d) ? 'bg-pink-600 text-white font-bold' : ''}
            `}
          >
            {d.getDate()}
          </button>
        ))}
      </div>
    </div>
  );
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((v) => Number(v));
  return h * 60 + (m || 0);
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && endA > startB;
}

type DayWindow = { open: string; close: string; enabled: boolean };

const buildAvailableTimeSlots = (serviceDuration: number, window: DayWindow, bookings: Array<{ time: string; duration: number }>, selectedDate: Date) => {
  const defaultWindow: DayWindow = { open: '09:00', close: '20:00', enabled: true };
  const w = window?.enabled ? window : defaultWindow;
  const openMin = toMinutes(w.open.slice(0,5));
  const closeMin = toMinutes(w.close.slice(0,5));

  // Passo base de 30 minutos para ofertar slots padronizados
  const step = 30;

  // Bloqueios existentes (bookings) convertidos em minutos
  const blocks = (bookings || []).map(b => {
    const start = toMinutes((b.time || '00:00').slice(0,5));
    const end = start + Number(b.duration || 0);
    return { start, end };
  });

  const slots: string[] = [];
  const now = new Date();
  const isToday = selectedDate.toDateString() === now.toDateString();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (let t = openMin; t + serviceDuration <= closeMin; t += step) {
    // Se é hoje, não permitir horários passados
    if (isToday && t <= nowMin) continue;

    const slotStart = t;
    const slotEnd = t + serviceDuration;

    // Checar sobreposição com qualquer reserva
    const clashes = blocks.some(b => overlaps(slotStart, slotEnd, b.start, b.end));
    if (clashes) continue;

    const hh = String(Math.floor(t / 60)).padStart(2, '0');
    const mm = String(t % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }

  // Separar por períodos (respeitando janelas reais)
  const morning = slots.filter(time => {
    const hour = parseInt(time.split(':')[0]);
    return hour >= parseInt(w.open) && hour < Math.min(12, parseInt(w.close));
  });
  const afternoon = slots.filter(time => {
    const hour = parseInt(time.split(':')[0]);
    return hour >= Math.max(12, parseInt(w.open)) && hour < Math.min(18, parseInt(w.close));
  });
  const evening = slots.filter(time => {
    const hour = parseInt(time.split(':')[0]);
    return hour >= Math.max(18, parseInt(w.open)) && hour < parseInt(w.close);
  });

  return { morning, afternoon, evening };
};

const DateTimePicker: React.FC<DateTimePickerProps> = ({ onBack, onDateTimeSelect, serviceDuration }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [maxDate, setMaxDate] = useState<Date | null>(null);
  const [dayWindow, setDayWindow] = useState<DayWindow>({ open: '09:00', close: '20:00', enabled: true });
  const [bookedBlocks, setBookedBlocks] = useState<Array<{ time: string; duration: number }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/schedule-settings');
        const data = await res.json();
        if (res.ok) {
          if (data?.booking_limit_month) {
            const [y, m] = String(data.booking_limit_month).split('-').map((v: string) => Number(v));
            if (y && m) {
              const d = new Date(y, m, 0);
              setMaxDate(d);
            }
          }
          // Definir janela por dia da semana, se existir
          const weekday = selectedDate.getDay(); // 0..6
          const h = (data?.business_hours || []).find((x: any) => Number(x.weekday) === Number(weekday));
          if (h) {
            setDayWindow({
              enabled: !!h.enabled,
              open: String(h.open_time || '09:00').slice(0,5),
              close: String(h.close_time || '20:00').slice(0,5),
            });
          } else {
            setDayWindow({ open: '09:00', close: '20:00', enabled: true });
          }
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate.toDateString()]);

  // Carregar agendamentos do dia para bloquear sobreposições
  useEffect(() => {
    (async () => {
      try {
        const y = selectedDate.getFullYear();
        const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const d = String(selectedDate.getDate()).padStart(2, '0');
        const yyyyMMdd = `${y}-${m}-${d}`;
        const qs = new URLSearchParams({ from: yyyyMMdd, to: yyyyMMdd });
        const res = await fetch(`/api/bookings?${qs.toString()}`);
        const data = await res.json();
        if (res.ok) {
          const rows = Array.isArray(data?.bookings) ? data.bookings : [];
          setBookedBlocks(rows.map((b: any) => ({ time: String(b.time || '00:00:00'), duration: Number(b.total_duration_minutes || 0) })));
        } else {
          setBookedBlocks([]);
        }
      } catch {
        setBookedBlocks([]);
      }
    })();
  }, [selectedDate]);

  const availableSlots = useMemo(() => buildAvailableTimeSlots(serviceDuration, dayWindow, bookedBlocks, selectedDate), [serviceDuration, dayWindow, bookedBlocks, selectedDate]);
  
  const handleNext = () => {
    if (selectedDate && selectedTime) {
      onDateTimeSelect(selectedDate, selectedTime);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 md:p-8 rounded-2xl border border-gray-300 shadow-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Escolha a Data e Hora</h2>
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} maxDate={maxDate || undefined} />
        </div>
        <div className="max-h-[400px] overflow-y-auto pr-2">
            <h3 className="font-bold text-lg mb-4 text-gray-900">Horários disponíveis para {selectedDate.toLocaleDateString('pt-BR')}</h3>
            {Object.entries(availableSlots).map(([period, slots]) => (
                <div key={period} className="mb-4">
                    <h4 className="font-semibold text-pink-600 mb-2 capitalize">{period === 'morning' ? 'Manhã' : period === 'afternoon' ? 'Tarde' : 'Noite'}</h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {/* Fix: Use Array.isArray as a type guard to ensure 'slots' is treated as an array, resolving the 'unknown' type issue. */}
                        {Array.isArray(slots) && slots.map(time => (
                            <button 
                                key={time} 
                                onClick={() => setSelectedTime(time)}
                                className={`p-2 rounded-lg transition-colors duration-200 border-2 text-gray-900
                                    ${selectedTime === time ? 'bg-pink-600 text-white border-pink-600 font-bold' : 'bg-gray-50 border-gray-300 hover:border-pink-600'}
                                `}
                            >
                                {time}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
      </div>
      <div className="flex justify-between mt-8 border-t border-gray-300 pt-6">
        <button onClick={onBack} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg transition-colors">Voltar</button>
        <button 
            onClick={handleNext}
            disabled={!selectedTime}
            className="bg-pink-600 hover:bg-pink-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-500 shadow-md"
        >
            Próximo
        </button>
      </div>
    </div>
  );
};

export default DateTimePicker;