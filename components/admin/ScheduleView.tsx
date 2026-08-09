import React, { useEffect, useMemo, useState } from 'react';
import { CalendarIcon, WhatsAppIcon, whatsAppNumber } from '../icons';

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
  const [editId, setEditId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editTime, setEditTime] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

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

  const openEdit = (b: BookingRow) => {
    setEditId(b.booking_id);
    setEditDate(b.date);
    setEditTime(b.time.slice(0,5));
  };

  const saveEdit = async () => {
    if (!editId) return;
    setActionLoadingId(editId);
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reschedule', booking_id: editId, date: editDate, time: editTime }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao atualizar horário');
      setEditId(null);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Erro ao atualizar horário');
    } finally {
      setActionLoadingId(null);
    }
  };

  const cancelBooking = async (id: string) => {
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;
    setActionLoadingId(id);
    try {
      const res = await fetch('/api/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: id, status: 'cancelled' }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao cancelar');
      await load();
    } catch (e: any) {
      alert(e?.message || 'Erro ao cancelar');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold gold-text text-center mb-4">Agenda por Profissional</h2>
        <div className="flex items-center justify-center gap-3">
          <CalendarIcon className="w-6 h-6 text-gold" />
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="bg-surface-raised text-white border border-line rounded px-3 py-2"
          >
            <option value="">Selecione o profissional</option>
            {professionals.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="inline-flex rounded overflow-hidden border border-line">
          <button onClick={() => setView('month')} className={`px-3 py-2 ${view==='month'?'bg-gold text-white':'bg-surface-raised text-zinc-200'}`}>Mês</button>
          <button onClick={() => setView('week')} className={`px-3 py-2 ${view==='week'?'bg-gold text-white':'bg-surface-raised text-zinc-200'}`}>Semana</button>
          <button onClick={() => setView('day')} className={`px-3 py-2 ${view==='day'?'bg-gold text-white':'bg-surface-raised text-zinc-200'}`}>Dia</button>
        </div>
        <div className="inline-flex items-center gap-2">
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-2 bg-surface-muted text-white rounded">Hoje</button>
          <button
            onClick={() => {
              const d = new Date(currentDate);
              if (view === 'day') d.setDate(d.getDate() - 1);
              else if (view === 'week') d.setDate(d.getDate() - 7);
              else d.setMonth(d.getMonth() - 1);
              setCurrentDate(d);
            }}
            className="px-3 py-2 bg-surface-raised text-white rounded border border-line"
          >
            ◀
          </button>
          <div className="text-zinc-200 font-semibold min-w-[140px] text-center">
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
            className="px-3 py-2 bg-surface-raised text-white rounded border border-line"
          >
            ▶
          </button>
        </div>
      </div>

      {error && <div className="text-red-400 mb-4">{error}</div>}

      {!selected && <div className="text-zinc-300">Escolha um profissional para visualizar a agenda.</div>}
      {selected && loading && <div className="text-zinc-200">Carregando agenda...</div>}

      {selected && !loading && grouped.length === 0 && (
        <div className="text-zinc-300">Nenhum agendamento para este período.</div>
      )}

      {/* Dia */}
      {selected && !loading && view === 'day' && (
        <div className="mb-6">
          <h3 className="text-gold font-bold text-lg mb-3 pb-2 border-b-2 border-line">
            {currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(grouped.find(([d]) => d === formatDate(currentDate))?.[1] || [])
              .sort((a,b) => a.time.localeCompare(b.time))
              .map(b => (
              <div key={b.booking_id} className="bg-surface-raised p-5 rounded-lg border border-line">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-bold text-white">{b.client_name}</h4>
                    {b.client_phone && (
                      <p className="text-sm text-zinc-300 flex items-center gap-1.5 mt-0.5">
                        <span>{b.client_phone}</span>
                        <a
                          href={`https://wa.me/${whatsAppNumber(b.client_phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-700 inline-flex"
                          title="Abrir WhatsApp"
                        >
                          <WhatsAppIcon className="w-5 h-5" />
                        </a>
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gold text-lg">R${Number(b.total_price).toFixed(2)}</p>
                    <p className="text-sm text-zinc-200">{b.time.slice(0,5)}</p>
                  </div>
                </div>
                <div className="border-t border-line my-3"></div>
                <div>
                  <h5 className="font-semibold mb-2 text-zinc-200">Serviços:</h5>
                  <ul className="list-disc list-inside text-zinc-200 space-y-1">
                    {(b.services || []).map(s => (<li key={s.id}>{s.name}</li>))}
                  </ul>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openEdit(b)}
                    className="bg-gray-900 hover:bg-black text-white font-semibold px-3 py-2 rounded"
                  >
                    Alterar horário
                  </button>
                  <button
                    onClick={() => cancelBooking(b.booking_id)}
                    disabled={actionLoadingId === b.booking_id}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold px-3 py-2 rounded"
                  >
                    {actionLoadingId === b.booking_id ? 'Cancelando...' : 'Cancelar'}
                  </button>
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
              <div key={key} className="bg-surface-raised rounded border border-line p-3">
                <div
                  className="font-semibold text-zinc-200 mb-2 cursor-pointer hover:text-gold"
                  onClick={() => { setCurrentDate(day); setView('day'); }}
                  title="Ver dia"
                >
                  {day.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}
                </div>
                {rows.length === 0 ? (
                  <div className="text-zinc-400 text-sm">Sem agendamentos</div>
                ) : (
                  <ul className="space-y-2">
                    {rows.sort((a,b) => a.time.localeCompare(b.time)).map(b => (
                      <li key={b.booking_id} className="bg-surface-muted/60 rounded px-2 py-1 flex justify-between">
                        <span className="text-zinc-200">{b.time.slice(0,5)}</span>
                        <span className="text-zinc-200">{b.client_name}</span>
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
                  className={`p-2 rounded border cursor-pointer ${inMonth ? 'border-line bg-surface-raised hover:border-gold' : 'border-line bg-surface-overlay/40'}`}
                  style={{ aspectRatio: '1 / 1' }}
                  onClick={() => { setMonthSelectedDate(day); }}
                  title="Listar agendamentos do dia abaixo"
                >
                  <div className={`text-sm mb-2 ${inMonth ? 'text-zinc-200' : 'text-zinc-400'}`}>
                    {day.getDate().toString().padStart(2,'0')}
                  </div>
                  <div className="mt-auto">
                    <span className={`text-xs font-semibold ${rows.length ? 'text-gold' : 'text-zinc-400'}`}>
                      {rows.length ? rows.length : '—'}
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
          <h3 className="text-gold font-bold text-lg mb-3 pb-2 border-b-2 border-line">
            {monthSelectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(grouped.find(([d]) => d === formatDate(monthSelectedDate))?.[1] || [])
              .sort((a,b) => a.time.localeCompare(b.time))
              .map(b => (
              <div key={b.booking_id} className="bg-surface-raised p-5 rounded-lg border border-line">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-bold text-white">{b.client_name}</h4>
                    {b.client_phone && (
                      <p className="text-sm text-zinc-300 flex items-center gap-1.5 mt-0.5">
                        <span>{b.client_phone}</span>
                        <a
                          href={`https://wa.me/${whatsAppNumber(b.client_phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-700 inline-flex"
                          title="Abrir WhatsApp"
                        >
                          <WhatsAppIcon className="w-5 h-5" />
                        </a>
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gold text-lg">R${Number(b.total_price).toFixed(2)}</p>
                    <p className="text-sm text-zinc-200">{b.time.slice(0,5)}</p>
                  </div>
                </div>
                <div className="border-t border-line my-3"></div>
                <div>
                  <h5 className="font-semibold mb-2 text-zinc-200">Serviços:</h5>
                  <ul className="list-disc list-inside text-zinc-200 space-y-1">
                    {(b.services || []).map(s => (<li key={s.id}>{s.name}</li>))}
                  </ul>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openEdit(b)}
                    className="bg-gray-900 hover:bg-black text-white font-semibold px-3 py-2 rounded"
                  >
                    Alterar horário
                  </button>
                  <button
                    onClick={() => cancelBooking(b.booking_id)}
                    disabled={actionLoadingId === b.booking_id}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold px-3 py-2 rounded"
                  >
                    {actionLoadingId === b.booking_id ? 'Cancelando...' : 'Cancelar'}
                  </button>
                </div>
              </div>
            ))}
            {(grouped.find(([d]) => d === formatDate(monthSelectedDate))?.[1] || []).length === 0 && (
              <div className="text-zinc-300">Sem agendamentos para o dia selecionado.</div>
            )}
          </div>
        </div>
      )}

      {editId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-surface-raised rounded-2xl border border-line shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xl font-bold text-white">Alterar horário</h4>
              <button onClick={() => setEditId(null)} className="text-zinc-400 hover:text-zinc-200">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-200 mb-1">Nova data</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full bg-surface-overlay border border-line rounded-lg p-3 text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-200 mb-1">Novo horário</label>
                <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="w-full bg-surface-overlay border border-line rounded-lg p-3 text-white" />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button className="px-4 py-2 rounded-lg border border-line" onClick={() => setEditId(null)}>Fechar</button>
                <button className="px-4 py-2 rounded-lg bg-gold text-white font-semibold hover:brightness-110" onClick={saveEdit}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScheduleView;

