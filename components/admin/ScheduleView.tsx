import React, { useEffect, useMemo, useState } from 'react';
import { CalendarIcon } from '../icons';

type Professional = {
  id: string;
  name: string;
}

type BookingRow = {
  booking_id: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:MM:SS
  professional_id: string | null;
  client_id: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  total_price: string;
  total_duration_minutes: number;
  services: Array<{
    id: number;
    name: string;
    price: number;
    duration_minutes: number;
    quantity: number;
  }>;
}

const ScheduleView: React.FC = () => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [monthSelectedDate, setMonthSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/professionals');
        const data = await res.json();
        if (res.ok) {
          setProfessionals((data.professionals || []).map((p: any) => ({ id: p.id, name: p.name })));
        }
      } catch {}
    })();
  }, []);

  const formatDate = (d: Date) => d.toISOString().slice(0,10);
  const startOfWeek = (d: Date) => {
    const day = (d.getDay() + 6) % 7; // Monday=0
    const r = new Date(d);
    r.setDate(d.getDate() - day);
    r.setHours(0,0,0,0);
    return r;
  };
  const endOfWeek = (d: Date) => {
    const r = startOfWeek(d);
    r.setDate(r.getDate() + 6);
    r.setHours(23,59,59,999);
    return r;
  };
  const startOfMonth = (d: Date) => {
    const r = new Date(d.getFullYear(), d.getMonth(), 1);
    r.setHours(0,0,0,0);
    return r;
  };
  const endOfMonth = (d: Date) => {
    const r = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    r.setHours(23,59,59,999);
    return r;
  };

  const load = async () => {
    if (!selected) { setBookings([]); return; }
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('professional_id', selected);
      // limitar janela de tempo conforme a visão
      if (view === 'day') {
        const from = formatDate(currentDate);
        const to = formatDate(currentDate);
        qs.set('from', from);
        qs.set('to', to);
      } else if (view === 'week') {
        const from = formatDate(startOfWeek(currentDate));
        const to = formatDate(endOfWeek(currentDate));
        qs.set('from', from);
        qs.set('to', to);
      } else {
        const from = formatDate(startOfMonth(currentDate));
        const to = formatDate(endOfMonth(currentDate));
        qs.set('from', from);
        qs.set('to', to);
      }
      const res = await fetch(`/api/bookings?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar agenda');
      setBookings(data.bookings || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, view, currentDate]);

  const grouped = useMemo(() => {
    const groups = new Map<string, BookingRow[]>();
    bookings.forEach(b => {
      const key = b.date;
      const arr = groups.get(key) || [];
      arr.push(b);
      groups.set(key, arr);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [bookings]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">Agenda por Profissional</h2>
        <div className="flex items-center justify-center gap-3">
          <CalendarIcon className="w-6 h-6 text-pink-600" />
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="bg-white text-gray-900 border border-gray-300 rounded px-3 py-2"
          >
            <option value="">Selecione o profissional</option>
            {professionals.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="inline-flex rounded overflow-hidden border border-gray-300">
          <button onClick={() => setView('month')} className={`px-3 py-2 ${view==='month'?'bg-pink-600 text-white':'bg-white text-gray-700'}`}>Mês</button>
          <button onClick={() => setView('week')} className={`px-3 py-2 ${view==='week'?'bg-pink-600 text-white':'bg-white text-gray-700'}`}>Semana</button>
          <button onClick={() => setView('day')} className={`px-3 py-2 ${view==='day'?'bg-pink-600 text-white':'bg-white text-gray-700'}`}>Dia</button>
        </div>
        <div className="inline-flex items-center gap-2">
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-2 bg-gray-200 text-gray-900 rounded">Hoje</button>
          <button
            onClick={() => {
              const d = new Date(currentDate);
              if (view === 'day') d.setDate(d.getDate() - 1);
              else if (view === 'week') d.setDate(d.getDate() - 7);
              else d.setMonth(d.getMonth() - 1);
              setCurrentDate(d);
            }}
            className="px-3 py-2 bg-white text-gray-900 rounded border border-gray-300"
          >
            ◀
          </button>
          <div className="text-gray-700 font-semibold min-w-[140px] text-center">
            {view === 'day' && currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            {view === 'week' && `${startOfWeek(currentDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - ${endOfWeek(currentDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
            {view === 'month' && currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </div>
          <button
            onClick={() => {
              const d = new Date(currentDate);
              if (view === 'day') d.setDate(d.getDate() + 1);
              else if (view === 'week') d.setDate(d.getDate() + 7);
              else d.setMonth(d.getMonth() + 1);
              setCurrentDate(d);
            }}
            className="px-3 py-2 bg-white text-gray-900 rounded border border-gray-300"
          >
            ▶
          </button>
        </div>
      </div>

      {error && <div className="text-red-400 mb-4">{error}</div>}

      {!selected && <div className="text-gray-600">Escolha um profissional para visualizar a agenda.</div>}
      {selected && loading && <div className="text-gray-700">Carregando agenda...</div>}

      {selected && !loading && grouped.length === 0 && (
        <div className="text-gray-600">Nenhum agendamento para este período.</div>
      )}

      {/* Dia */}
      {selected && !loading && view === 'day' && (
        <div className="mb-6">
          <h3 className="text-pink-600 font-bold text-lg mb-3 pb-2 border-b-2 border-gray-300">
            {currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(grouped.find(([d]) => d === formatDate(currentDate))?.[1] || [])
              .sort((a,b) => a.time.localeCompare(b.time))
              .map(b => (
              <div key={b.booking_id} className="bg-white p-5 rounded-lg border border-gray-300">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-bold text-gray-900">{b.client_name}</h4>
                    <p className="text-sm text-gray-600">{b.client_phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-pink-600 text-lg">R${Number(b.total_price).toFixed(2)}</p>
                    <p className="text-sm text-gray-700">{b.time.slice(0,5)}</p>
                  </div>
                </div>
                <div className="border-t border-gray-600 my-3"></div>
                <div>
                  <h5 className="font-semibold mb-2 text-gray-700">Serviços:</h5>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    {(b.services || []).map(s => (<li key={s.id}>{s.name}</li>))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Semana */}
      {selected && !loading && view === 'week' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => {
            const day = new Date(startOfWeek(currentDate));
            day.setDate(day.getDate() + i);
            const key = formatDate(day);
            const rows = grouped.find(([d]) => d === key)?.[1] || [];
            return (
              <div key={key} className="bg-white rounded border border-gray-300 p-3">
                <div
                  className="font-semibold text-gray-700 mb-2 cursor-pointer hover:text-pink-600"
                  onClick={() => { setCurrentDate(day); setView('day'); }}
                  title="Ver dia"
                >
                  {day.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}
                </div>
                {rows.length === 0 ? (
                  <div className="text-gray-500 text-sm">Sem agendamentos</div>
                ) : (
                  <ul className="space-y-2">
                    {rows.sort((a,b) => a.time.localeCompare(b.time)).map(b => (
                      <li key={b.booking_id} className="bg-gray-200/60 rounded px-2 py-1 flex justify-between">
                        <span className="text-gray-700">{b.time.slice(0,5)}</span>
                        <span className="text-gray-700">{b.client_name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Mês */}
      {selected && !loading && view === 'month' && (
        <div className="grid grid-cols-7 gap-2">
          {(() => {
            const first = startOfMonth(currentDate);
            const start = startOfWeek(first);
            const cells: Date[] = [];
            for (let i = 0; i < 42; i++) {
              const d = new Date(start);
              d.setDate(start.getDate() + i);
              cells.push(d);
            }
            return cells.map((day, idx) => {
              const key = formatDate(day);
              const inMonth = day.getMonth() === currentDate.getMonth();
              const rows = grouped.find(([d]) => d === key)?.[1] || [];
              return (
                <div
                  key={idx}
                  className={`p-2 rounded border cursor-pointer ${inMonth ? 'border-gray-300 bg-white hover:border-pink-600' : 'border-gray-200 bg-gray-50/40'}`}
                  style={{ aspectRatio: '1 / 1' }}
                  onClick={() => { setMonthSelectedDate(day); }}
                  title="Listar agendamentos do dia abaixo"
                >
                  <div className={`text-sm mb-2 ${inMonth ? 'text-gray-700' : 'text-gray-500'}`}>
                    {day.getDate().toString().padStart(2,'0')}
                  </div>
                  <div className="mt-auto">
                    <span className={`text-xs font-semibold ${rows.length ? 'text-pink-600' : 'text-gray-500'}`}>
                      {rows.length ? `${rows.length} agend.` : '—'}
                    </span>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {selected && !loading && view === 'month' && monthSelectedDate && (
        <div className="mt-6 mb-6">
          <h3 className="text-pink-600 font-bold text-lg mb-3 pb-2 border-b-2 border-gray-300">
            {monthSelectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(grouped.find(([d]) => d === formatDate(monthSelectedDate))?.[1] || [])
              .sort((a,b) => a.time.localeCompare(b.time))
              .map(b => (
              <div key={b.booking_id} className="bg-white p-5 rounded-lg border border-gray-300">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-bold text-gray-900">{b.client_name}</h4>
                    <p className="text-sm text-gray-600">{b.client_phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-pink-600 text-lg">R${Number(b.total_price).toFixed(2)}</p>
                    <p className="text-sm text-gray-700">{b.time.slice(0,5)}</p>
                  </div>
                </div>
                <div className="border-t border-gray-600 my-3"></div>
                <div>
                  <h5 className="font-semibold mb-2 text-gray-700">Serviços:</h5>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    {(b.services || []).map(s => (<li key={s.id}>{s.name}</li>))}
                  </ul>
                </div>
              </div>
            ))}
            {(grouped.find(([d]) => d === formatDate(monthSelectedDate))?.[1] || []).length === 0 && (
              <div className="text-gray-600">Sem agendamentos para o dia selecionado.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ScheduleView;

