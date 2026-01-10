import React, { useEffect, useMemo, useState } from 'react';
import { CalendarIcon } from '../icons';

type Professional = { id: string; name: string; };
type Service = { id: number; name: string; };

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

const AppointmentsView: React.FC = () => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [professionalId, setProfessionalId] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>('');
  const [clientQuery, setClientQuery] = useState<string>('');
  const [time, setTime] = useState<string>(''); // HH:MM
  const [timeFrom, setTimeFrom] = useState<string>(''); // HH:MM
  const [timeTo, setTimeTo] = useState<string>(''); // HH:MM

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestsMap, setRequestsMap] = useState<Record<string, Array<{ id: string; requested_date: string; requested_time: string; status: string; created_at?: string }>>>({});
  const [cancellations, setCancellations] = useState<Array<{
    id: string;
    at: string;
    booking_date: string;
    booking_time: string;
    client_name?: string;
    client_phone?: string;
  }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const [proRes, srvRes] = await Promise.all([
          fetch('/api/professionals'),
          fetch('/api/services')
        ]);
        if (proRes.ok) {
          const j = await proRes.json();
          setProfessionals((j.professionals || []).map((p: any) => ({ id: p.id, name: p.name })));
        }
        if (srvRes.ok) {
          const j = await srvRes.json();
          setServices((j.services || []).map((s: any) => ({ id: s.id, name: s.name })));
        }
      } catch {}
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (professionalId) qs.set('professional_id', professionalId);
      if (serviceId) qs.set('service_id', serviceId);
      if (clientQuery) qs.set('client', clientQuery);
      if (time) qs.set('time', time);
      if (!time && timeFrom) qs.set('time_from', timeFrom);
      if (!time && timeTo) qs.set('time_to', timeTo);
      const url = `/api/bookings${qs.toString() ? `?${qs.toString()}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar agendamentos');
      const list = (data.bookings || []) as BookingRow[];
      setBookings(list);
      const ids = list.map(r => r.booking_id).join(',');
      if (ids) {
        try {
          const rres = await fetch(`/api/reschedule-requests?booking_ids=${encodeURIComponent(ids)}`);
          const rdata = await rres.json();
          if (rres.ok && Array.isArray(rdata?.requests)) {
            const map: Record<string, Array<any>> = {};
            for (const req of rdata.requests) {
              const arr = map[req.booking_id] || [];
              arr.push(req);
              map[req.booking_id] = arr;
            }
            Object.keys(map).forEach(k => map[k].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))));
            setRequestsMap(map);
          } else {
            setRequestsMap({});
          }
        } catch { setRequestsMap({}); }
      } else {
        setRequestsMap({});
      }

      // Carregar cancelamentos de clientes (últimos 50, opcionalmente filtrados por profissional)
      try {
        const qs2 = new URLSearchParams();
        if (professionalId) qs2.set('professional_id', professionalId);
        qs2.set('cancelled_by', 'client');
        qs2.set('limit', '50');
        const cRes = await fetch(`/api/cancellations?${qs2.toString()}`);
        const cData = await cRes.json();
        if (cRes.ok && Array.isArray(cData?.cancellations)) {
          const rows = (cData.cancellations as any[]).map((r) => ({
            id: r.id,
            at: r.created_at,
            booking_date: r.bookings?.date,
            booking_time: r.bookings?.time,
            client_name: r.bookings?.clients?.name,
            client_phone: r.bookings?.clients?.phone,
          }));
          setCancellations(rows);
        } else {
          setCancellations([]);
        }
      } catch { setCancellations([]); }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Carregar agendamentos quando o componente monta e quando os filtros mudam
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId, serviceId, clientQuery, time, timeFrom, timeTo]);

  const approve = async (bookingId: string) => {
    const req = (requestsMap[bookingId] || []).find(x => x.status === 'pending');
    if (!req) return;
    try {
      const res = await fetch('/api/reschedule-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: req.id, action: 'approve' }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao aprovar solicitação');
      await load();
    } catch (e: any) {
      alert(e?.message || 'Erro ao aprovar solicitação');
    }
  };

  const deny = async (bookingId: string) => {
    const req = (requestsMap[bookingId] || []).find(x => x.status === 'pending');
    if (!req) return;
    try {
      const res = await fetch('/api/reschedule-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: req.id, action: 'deny' }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao negar solicitação');
      await load();
    } catch (e: any) {
      alert(e?.message || 'Erro ao negar solicitação');
    }
  };

  // Alterar / Cancelar direto pelo admin
  const [editId, setEditId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editTime, setEditTime] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

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
        body: JSON.stringify({ booking_id: id, status: 'cancelled', cancelled_by: 'admin' }),
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

  const grouped = useMemo(() => {
    const m = new Map<string, BookingRow[]>();
    bookings.forEach(b => {
      const key = b.date;
      const arr = m.get(key) || [];
      arr.push(b);
      m.set(key, arr);
    });
    return Array.from(m.entries()).sort(([a],[b]) => a.localeCompare(b));
  }, [bookings]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">Agendamentos</h2>
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Profissional</label>
            <select
              value={professionalId}
              onChange={e => setProfessionalId(e.target.value)}
              className="w-full bg-white text-gray-900 border border-gray-300 rounded px-3 py-2"
            >
              <option value="">Todos</option>
              {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Serviço</label>
            <select
              value={serviceId}
              onChange={e => setServiceId(e.target.value)}
              className="w-full bg-white text-gray-900 border border-gray-300 rounded px-3 py-2"
            >
              <option value="">Todos</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Cliente</label>
            <input
              value={clientQuery}
              onChange={e => setClientQuery(e.target.value)}
              placeholder="Nome, e-mail ou telefone"
              className="w-full bg-white text-gray-900 border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Horário exato</label>
            <input
              type="time"
              value={time}
              onChange={e => { setTime(e.target.value); }}
              className="w-full bg-white text-gray-900 border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-gray-600 mb-1">De</label>
              <input
                type="time"
                value={timeFrom}
                onChange={e => { setTimeFrom(e.target.value); if (time) setTime(''); }}
                className="w-full bg-white text-gray-900 border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Até</label>
              <input
                type="time"
                value={timeTo}
                onChange={e => { setTimeTo(e.target.value); if (time) setTime(''); }}
                className="w-full bg-white text-gray-900 border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>
          <div className="md:col-span-5 flex justify-end">
            <button
              onClick={() => {
                setProfessionalId('');
                setServiceId('');
                setClientQuery('');
                setTime('');
                setTimeFrom('');
                setTimeTo('');
              }}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded transition-colors"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      </div>

      {error && <div className="text-red-400 mb-4">{error}</div>}

      {/* Cancelamentos feitos pelos clientes */}
      <div className="mb-6 bg-white border border-gray-300 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Cancelamentos dos clientes</h3>
          <button onClick={load} className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-900">
            Atualizar
          </button>
        </div>
        {cancellations.length === 0 ? (
          <div className="text-gray-600 text-sm mt-2">Nenhum cancelamento recente.</div>
        ) : (
          <ul className="mt-2 divide-y divide-gray-200">
            {cancellations.map(c => (
              <li key={c.id} className="py-2 text-sm text-gray-800 flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.client_name || 'Cliente'}</div>
                  <div className="text-gray-600">{c.client_phone || '-'}</div>
                </div>
                <div className="text-right">
                  <div>{new Date(c.booking_date).toLocaleDateString('pt-BR')} às {String(c.booking_time || '').slice(0,5)}</div>
                  <div className="text-xs text-gray-500">Cancelado em {new Date(c.at).toLocaleString('pt-BR')}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {loading && <div className="text-gray-700">Carregando...</div>}

      {!loading && grouped.length === 0 && (
        <div className="text-gray-600">Nenhum agendamento encontrado com os filtros selecionados.</div>
      )}

      <div className="space-y-6">
        {grouped.map(([date, rows]) => {
          // Parse da data no formato yyyy-mm-dd evitando problemas de fuso horário
          const [year, month, day] = date.split('-').map(Number);
          const dateObj = new Date(year, month - 1, day);
          
          return (
          <div key={date}>
            <h3 className="text-pink-600 font-bold text-lg mb-3 pb-2 border-b-2 border-gray-300">
              {dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </h3>
            <div className="space-y-2">
              {rows.sort((a,b) => a.time.localeCompare(b.time)).map(b => (
                <div key={b.booking_id} className="bg-white px-4 py-4 rounded-lg border border-gray-300 hover:border-pink-600 transition-colors duration-200">
                  {/* Linha 1: hora + cliente/serviços à esquerda, preço à direita */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="text-pink-600 font-bold text-lg tabular-nums flex-shrink-0">{b.time.slice(0,5)}</div>
                      <div className="min-w-0">
                        <div className="text-gray-900 font-semibold break-words">{b.client_name}</div>
                        <div className="text-gray-600 text-sm break-words">{(b.services || []).map(s => s.name).join(', ')}</div>
                      </div>
                    </div>
                    <div className="text-pink-600 font-bold whitespace-nowrap">R${Number(b.total_price).toFixed(2)}</div>
                  </div>

                  {/* Linha 2: botões alinhados à esquerda */}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => openEdit(b)}
                      className="px-3 py-2 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded"
                      title="Alterar horário"
                    >
                      Alterar
                    </button>
                    <button
                      onClick={() => cancelBooking(b.booking_id)}
                      disabled={actionLoadingId === b.booking_id}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold rounded"
                      title="Cancelar"
                    >
                      {actionLoadingId === b.booking_id ? '...' : 'Cancelar'}
                    </button>
                  </div>
                  <div className="mt-2">
                    {Boolean((requestsMap[b.booking_id] || []).find(x => x.status === 'pending')) ? (
                      <div className="flex items-center justify-between">
                        {(() => {
                          const req = (requestsMap[b.booking_id] || []).find(x => x.status === 'pending')!;
                          return (
                            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                              Solicitação de troca: {new Date(req.requested_date).toLocaleDateString('pt-BR')} às {req.requested_time.slice(0,5)}
                            </div>
                          );
                        })()}
                        <div className="flex items-center gap-2">
                          <button onClick={() => approve(b.booking_id)} className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded">
                            Aprovar
                          </button>
                          <button onClick={() => deny(b.booking_id)} className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded">
                            Negar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">Sem solicitações pendentes</div>
                    )}
                    <details className="mt-1 text-gray-700">
                      <summary className="cursor-pointer select-none text-xs">Histórico de solicitações</summary>
                      <ul className="mt-1 space-y-1">
                        {(requestsMap[b.booking_id] || []).map((q, idx) => (
                          <li key={q.id || idx} className="text-xs">
                            <span className="font-medium">
                              {q.status === 'pending' ? 'Pendente' : q.status === 'approved' ? 'Aprovada' : q.status === 'denied' ? 'Negada' : q.status}
                            </span>
                            {' — '}
                            {new Date(q.requested_date).toLocaleDateString('pt-BR')} {q.requested_time.slice(0,5)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                </div>
              ))}
            </div>
          </div>
          );
        })}
      </div>

      {editId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-300 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xl font-bold text-gray-900">Alterar horário</h4>
              <button onClick={() => setEditId(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova data</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Novo horário</label>
                <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900" />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button className="px-4 py-2 rounded-lg border border-gray-300" onClick={() => setEditId(null)}>Fechar</button>
                <button className="px-4 py-2 rounded-lg bg-pink-600 text-white font-semibold hover:bg-pink-700" onClick={saveEdit}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsView;
