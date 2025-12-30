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
  const [completingId, setCompletingId] = useState<string | null>(null);

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
      setBookings(data.bookings || []);
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

  const markAsCompleted = async (bookingId: string) => {
    if (!confirm('Deseja marcar este atendimento como concluído? Isso enviará mensagens de confirmação via WhatsApp para o cliente e o profissional.')) {
      return;
    }

    setCompletingId(bookingId);
    try {
      const res = await fetch('/api/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId,
          status: 'completed',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao marcar como concluído');
      }

      alert('Atendimento marcado como concluído! As mensagens foram enviadas via WhatsApp.');
      load(); // Recarregar lista
    } catch (e: any) {
      alert(e?.message || 'Erro ao marcar atendimento como concluído');
    } finally {
      setCompletingId(null);
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
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rows.sort((a,b) => a.time.localeCompare(b.time)).map(b => (
                <div key={b.booking_id} className="bg-white p-5 rounded-lg border border-gray-300 hover:border-pink-600 transition-colors duration-300">
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
                  <div className="border-t border-gray-300 my-3"></div>
                  <div>
                    <h5 className="font-semibold mb-2 text-gray-200">Serviços:</h5>
                    <ul className="list-disc list-inside text-gray-700 space-y-1">
                      {(b.services || []).map(s => (
                        <li key={s.id}>{s.name}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="border-t border-gray-300 my-3 pt-3">
                    <button
                      onClick={() => markAsCompleted(b.booking_id)}
                      disabled={completingId === b.booking_id}
                      className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded transition-colors flex items-center justify-center gap-2"
                    >
                      {completingId === b.booking_id ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          <span>Processando...</span>
                        </>
                      ) : (
                        <>
                          <span>✅</span>
                          <span>Marcar como Concluído</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default AppointmentsView;
