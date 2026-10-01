import React, { useEffect, useMemo, useState } from 'react';
import { CalendarIcon, WhatsAppIcon, whatsAppNumber } from '../icons';
import BookingSourceTag from './BookingSourceTag';
import CardPagination from '@/components/ui/card-pagination';

type Professional = { id: string; name: string; };
type Service = { id: number; name: string; };

type BookingRow = {
  booking_id: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:MM:SS
  source?: string | null;
  confirmed_at?: string | null;
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
    variant_label?: string | null;
  }>;
}

function formatBookingServiceLabel(service: BookingRow['services'][number]): string {
  if (service.variant_label) return `${service.name} (${service.variant_label})`;
  return service.name;
}

async function parseJsonResponse(res: Response): Promise<any> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    const msg = res.ok
      ? 'Resposta inválida do servidor. Tente novamente.'
      : (res.status >= 500 ? `Erro do servidor (${res.status}). Tente novamente mais tarde.` : `Erro ${res.status}. Tente novamente.`);
    throw new Error(msg);
  }
}

const AppointmentsView: React.FC = () => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [professionalId, setProfessionalId] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>('');
  const [clientQuery, setClientQuery] = useState<string>('');
  const [debouncedClientQuery, setDebouncedClientQuery] = useState<string>('');
  const [time, setTime] = useState<string>(''); // HH:MM
  const [timeFrom, setTimeFrom] = useState<string>(''); // HH:MM
  const [timeTo, setTimeTo] = useState<string>(''); // HH:MM
  const [dateFrom, setDateFrom] = useState<string>(''); // yyyy-mm-dd
  const [dateTo, setDateTo] = useState<string>(''); // yyyy-mm-dd

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestsMap, setRequestsMap] = useState<Record<string, Array<{ id: string; requested_date: string; requested_time: string; status: string; created_at?: string }>>>({});
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedClientQuery(clientQuery.trim()), 350);
    return () => clearTimeout(timer);
  }, [clientQuery]);

  useEffect(() => {
    (async () => {
      try {
        const [proRes, srvRes] = await Promise.all([
          fetch('/api/professionals', { credentials: 'same-origin' }),
          fetch('/api/services', { credentials: 'same-origin' }),
        ]);
        if (proRes.ok) {
          const j = await parseJsonResponse(proRes).catch(() => ({}));
          setProfessionals((j.professionals || []).map((p: any) => ({ id: p.id, name: p.name })));
        }
        if (srvRes.ok) {
          const j = await parseJsonResponse(srvRes).catch(() => ({}));
          setServices((j.services || []).map((s: any) => ({ id: s.id, name: s.name })));
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setPage(1);
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const qs = new URLSearchParams();
        if (professionalId) qs.set('professional_id', professionalId);
        if (serviceId) qs.set('service_id', serviceId);
        if (debouncedClientQuery) qs.set('client', debouncedClientQuery);
        if (time) qs.set('time', time);
        if (!time && timeFrom) qs.set('time_from', timeFrom);
        if (!time && timeTo) qs.set('time_to', timeTo);
        if (dateFrom) qs.set('from', dateFrom);
        if (dateTo) qs.set('to', dateTo);
        const url = `/api/bookings${qs.toString() ? `?${qs.toString()}` : ''}`;
        const res = await fetch(url, {
          credentials: 'same-origin',
          signal: controller.signal,
        });
        const data = await parseJsonResponse(res);
        if (!res.ok) throw new Error(data?.error || 'Erro ao carregar agendamentos');
        let list = (data.bookings || []) as BookingRow[];

        // Filtro local de segurança: evita resultados errados por resposta atrasada/cache.
        if (debouncedClientQuery) {
          const normalize = (value: string) =>
            String(value || '')
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .trim();
          const q = normalize(debouncedClientQuery);
          const qDigits = debouncedClientQuery.replace(/\D/g, '');
          const qIsMostlyDigits = qDigits.length >= 3 && qDigits.length >= q.replace(/\s/g, '').length * 0.6;
          list = list.filter((r) => {
            const name = normalize(r.client_name || '');
            const email = normalize(r.client_email || '');
            const phoneDigits = String(r.client_phone || '').replace(/\D/g, '');
            return name.includes(q) || email.includes(q) || (qIsMostlyDigits && phoneDigits.includes(qDigits));
          });
        }

        if (controller.signal.aborted) return;
        setBookings(list);
        const ids = list.map((r) => r.booking_id).join(',');
        if (ids) {
          try {
            const rres = await fetch(`/api/reschedule-requests?booking_ids=${encodeURIComponent(ids)}`, {
              credentials: 'same-origin',
              signal: controller.signal,
            });
            const rdata = await parseJsonResponse(rres).catch(() => ({}));
            if (controller.signal.aborted) return;
            if (rres.ok && Array.isArray(rdata?.requests)) {
              const map: Record<string, Array<any>> = {};
              for (const req of rdata.requests) {
                const arr = map[req.booking_id] || [];
                arr.push(req);
                map[req.booking_id] = arr;
              }
              Object.keys(map).forEach((k) => map[k].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))));
              setRequestsMap(map);
            } else {
              setRequestsMap({});
            }
          } catch (e: any) {
            if (e?.name !== 'AbortError') setRequestsMap({});
          }
        } else {
          setRequestsMap({});
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setError(e.message || 'Erro ao carregar agendamentos');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [professionalId, serviceId, debouncedClientQuery, time, timeFrom, timeTo, dateFrom, dateTo]);

  const reloadBookings = async () => {
    setPage(1);
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (professionalId) qs.set('professional_id', professionalId);
      if (serviceId) qs.set('service_id', serviceId);
      if (debouncedClientQuery) qs.set('client', debouncedClientQuery);
      if (time) qs.set('time', time);
      if (!time && timeFrom) qs.set('time_from', timeFrom);
      if (!time && timeTo) qs.set('time_to', timeTo);
      if (dateFrom) qs.set('from', dateFrom);
      if (dateTo) qs.set('to', dateTo);
      const res = await fetch(`/api/bookings${qs.toString() ? `?${qs.toString()}` : ''}`, {
        credentials: 'same-origin',
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar agendamentos');
      let list = (data.bookings || []) as BookingRow[];
      if (debouncedClientQuery) {
        const normalize = (value: string) =>
          String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
        const q = normalize(debouncedClientQuery);
        const qDigits = debouncedClientQuery.replace(/\D/g, '');
        const qIsMostlyDigits = qDigits.length >= 3 && qDigits.length >= q.replace(/\s/g, '').length * 0.6;
        list = list.filter((r) => {
          const name = normalize(r.client_name || '');
          const email = normalize(r.client_email || '');
          const phoneDigits = String(r.client_phone || '').replace(/\D/g, '');
          return name.includes(q) || email.includes(q) || (qIsMostlyDigits && phoneDigits.includes(qDigits));
        });
      }
      setBookings(list);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar agendamentos');
    } finally {
      setLoading(false);
    }
  };

  const approve = async (bookingId: string) => {
    const req = (requestsMap[bookingId] || []).find(x => x.status === 'pending');
    if (!req) return;
    try {
      const res = await fetch('/api/reschedule-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: req.id, action: 'approve' }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao aprovar solicitação');
      await reloadBookings();
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
      const data = await parseJsonResponse(res);
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao negar solicitação');
      await reloadBookings();
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
      const data = await parseJsonResponse(res);
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao atualizar horário');
      setEditId(null);
      await reloadBookings();
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
      const data = await parseJsonResponse(res);
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao cancelar');
      await reloadBookings();
    } catch (e: any) {
      alert(e?.message || 'Erro ao cancelar');
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmBooking = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch('/api/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: id, status: 'confirmed' }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao confirmar agendamento');
      await reloadBookings();
    } catch (e: any) {
      alert(e?.message || 'Erro ao confirmar agendamento');
    } finally {
      setActionLoadingId(null);
    }
  };

  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return a.time.localeCompare(b.time);
    });
  }, [bookings]);

  const totalPages = Math.max(1, Math.ceil(sortedBookings.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageBookings = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedBookings.slice(start, start + PAGE_SIZE);
  }, [sortedBookings, page, PAGE_SIZE]);

  const grouped = useMemo(() => {
    const m = new Map<string, BookingRow[]>();
    pageBookings.forEach((b) => {
      const key = b.date;
      const arr = m.get(key) || [];
      arr.push(b);
      m.set(key, arr);
    });
    return Array.from(m.entries());
  }, [pageBookings]);

  const goToPage = (next: number) => {
    const clamped = Math.min(Math.max(1, next), totalPages);
    setPage(clamped);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold gold-text text-center mb-6">Agendamentos</h2>
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-sm text-zinc-300 mb-1">Profissional</label>
            <select
              value={professionalId}
              onChange={e => setProfessionalId(e.target.value)}
              className="w-full bg-surface-raised text-white border border-line rounded px-3 py-2"
            >
              <option value="">Todos</option>
              {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-300 mb-1">Serviço</label>
            <select
              value={serviceId}
              onChange={e => setServiceId(e.target.value)}
              className="w-full bg-surface-raised text-white border border-line rounded px-3 py-2"
            >
              <option value="">Todos</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-300 mb-1">Cliente</label>
            <input
              value={clientQuery}
              onChange={e => setClientQuery(e.target.value)}
              placeholder="Nome, e-mail ou telefone"
              className="w-full bg-surface-raised text-white border border-line rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-300 mb-1">Horário exato</label>
            <input
              type="time"
              value={time}
              onChange={e => { setTime(e.target.value); }}
              className="w-full bg-surface-raised text-white border border-line rounded px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-zinc-300 mb-1">De</label>
              <input
                type="time"
                value={timeFrom}
                onChange={e => { setTimeFrom(e.target.value); if (time) setTime(''); }}
                className="w-full bg-surface-raised text-white border border-line rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Até</label>
              <input
                type="time"
                value={timeTo}
                onChange={e => { setTimeTo(e.target.value); if (time) setTime(''); }}
                className="w-full bg-surface-raised text-white border border-line rounded px-3 py-2"
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
                setDateFrom('');
                setDateTo('');
                setPage(1);
              }}
              className="bg-surface-muted hover:bg-surface-muted text-white font-semibold px-4 py-2 rounded transition-colors"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      </div>

      {error && <div className="text-red-400 mb-4">{error}</div>}

      {loading && <div className="text-zinc-200">Carregando...</div>}

      {!loading && sortedBookings.length === 0 && (
        <div className="text-zinc-300">Nenhum agendamento encontrado com os filtros selecionados.</div>
      )}

      {!loading && sortedBookings.length > 0 && (
        <div className="flex items-center justify-between mb-4 text-sm text-zinc-300">
          <span>
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sortedBookings.length)} de {sortedBookings.length}
          </span>
          <span>
            Página {page} de {totalPages}
          </span>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
        <div>
          <label className="block text-sm text-zinc-300 mb-1">Data de</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full bg-surface-raised text-white border border-line rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-300 mb-1">Data até</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full bg-surface-raised text-white border border-line rounded px-3 py-2"
          />
        </div>
      </div>

      <div className="space-y-6">
        {grouped.map(([date, rows]) => {
          // Parse da data no formato yyyy-mm-dd evitando problemas de fuso horário
          const [year, month, day] = date.split('-').map(Number);
          const dateObj = new Date(year, month - 1, day);
          
          return (
          <div key={date}>
            <h3 className="text-gold font-bold text-lg mb-3 pb-2 border-b-2 border-line">
              {dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </h3>
            <div className="space-y-2">
              {rows.map(b => (
                <div key={b.booking_id} className="bg-surface-raised px-4 py-4 rounded-lg border border-line hover:border-gold transition-colors duration-200">
                  {/* Linha 1: hora + cliente/serviços à esquerda, preço à direita */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="text-gold font-bold text-lg tabular-nums flex-shrink-0">{b.time.slice(0,5)}</div>
                      <div className="min-w-0">
                        <div className="text-white font-semibold break-words">{b.client_name}</div>
                        {b.client_phone && (
                          <div className="text-zinc-300 text-sm flex items-center gap-1.5 mt-0.5">
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
                          </div>
                        )}
                        <div className="text-zinc-300 text-sm break-words">{(b.services || []).map(formatBookingServiceLabel).join(', ')}</div>
                        {b.confirmed_at && (
                          <span className="inline-block text-xs border rounded px-2 py-0.5 text-green-300 bg-green-950/40 border-green-800 mt-1.5 mr-1.5" title="Horário confirmado ao cliente">
                            ✓ Confirmado
                          </span>
                        )}
                        <BookingSourceTag source={b.source} className="mt-1.5" />
                      </div>
                    </div>
                    <div className="text-gold font-bold whitespace-nowrap">R${Number(b.total_price).toFixed(2)}</div>
                  </div>

                  {/* Linha 2: botões alinhados à esquerda */}
                  <div className="mt-3 flex items-center gap-2">
                    {!b.confirmed_at && (
                    <button
                      onClick={() => confirmBooking(b.booking_id)}
                      disabled={actionLoadingId === b.booking_id}
                      className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded"
                      title="Confirmar agendamento"
                    >
                      {actionLoadingId === b.booking_id ? '...' : 'Confirmar'}
                    </button>
                    )}
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
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded"
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
                            <div className="text-xs text-amber-300 bg-amber-950/40 border border-amber-800 rounded px-2 py-1">
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
                      <div className="text-xs text-zinc-400">Sem solicitações pendentes</div>
                    )}
                    <details className="mt-1 text-zinc-200">
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

      {!loading && sortedBookings.length > 0 && (
        <div className="mt-6 flex justify-center">
          <CardPagination page={page} totalPages={totalPages} onPageChange={goToPage} />
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
};

export default AppointmentsView;
