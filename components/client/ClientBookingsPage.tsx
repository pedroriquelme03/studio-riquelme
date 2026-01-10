import React, { useEffect, useState } from 'react';

type Row = {
  booking_id: string;
  date: string;
  time: string;
  services: Array<{ name: string; price: number }>;
  total_price: string;
};

const ClientBookingsPage: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phone = (typeof window !== 'undefined' && localStorage.getItem('client_phone')) || '';
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState<string>('');
  const [newTime, setNewTime] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [requests, setRequests] = useState<Record<string, { status: string; requested_date: string; requested_time: string }>>({});

  useEffect(() => {
    (async () => {
      if (!phone) return;
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ client: phone });
        const res = await fetch(`/api/bookings?${qs.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Erro ao carregar agendamentos');
        const list = (data.bookings || []) as Row[];
        setRows(list);
        // Buscar status de solicitações de troca para estes agendamentos
        const ids = list.map(r => r.booking_id).join(',');
        if (ids) {
          try {
            const rRes = await fetch(`/api/reschedule-requests?booking_ids=${encodeURIComponent(ids)}`);
            const rData = await rRes.json();
            if (rRes.ok && Array.isArray(rData?.requests)) {
              const map: Record<string, any> = {};
              for (const req of rData.requests) {
                map[req.booking_id] = { status: req.status, requested_date: req.requested_date, requested_time: req.requested_time };
              }
              setRequests(map);
            }
          } catch {}
        }
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar agendamentos');
      } finally {
        setLoading(false);
      }
    })();
  }, [phone]);

  if (!phone) {
    return (
      <div className="max-w-lg mx-auto text-center bg-white p-8 rounded-2xl border border-gray-300 shadow-xl">
        <p className="text-gray-700 mb-4">Você precisa entrar para ver seus agendamentos.</p>
        <a href="/login-cliente" className="text-pink-600 font-semibold hover:underline">Ir para login</a>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white p-6 md:p-8 rounded-2xl border border-gray-300 shadow-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Meus agendamentos</h2>
      <p className="text-gray-600 mb-6">Conectado pelo WhatsApp <span className="font-semibold">{phone}</span></p>

      {loading && <div className="text-gray-700">Carregando...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && rows.length === 0 && (
        <div className="text-gray-700">Nenhum agendamento encontrado.</div>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.booking_id} className="border border-gray-300 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-gray-900">
                {new Date(r.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} às {r.time?.slice(0,5)}
              </div>
              <div className="text-pink-600 font-bold">R${Number(r.total_price || 0).toFixed(2)}</div>
            </div>
            <div className="text-gray-700 mt-2">
              {(r.services || []).map(s => s.name).join(', ')}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 hover:bg-gray-50"
                onClick={() => {
                  setRescheduleId(r.booking_id);
                  setNewDate(r.date);
                  setNewTime((r.time || '').slice(0,5));
                }}
              >
                Solicitar troca
              </button>
              <button
                className="px-3 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50"
                onClick={async () => {
                  if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;
                  try {
                    setActionLoading(r.booking_id);
                    const res = await fetch('/api/bookings', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ booking_id: r.booking_id, status: 'cancelled' }),
                    });
                    const data = await res.json();
                    if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao cancelar');
                    setRows(prev => prev.filter(row => row.booking_id !== r.booking_id));
                  } catch (e: any) {
                    alert(e?.message || 'Erro ao cancelar');
                  } finally {
                    setActionLoading(null);
                  }
                }}
                disabled={actionLoading === r.booking_id}
              >
                {actionLoading === r.booking_id ? 'Cancelando...' : 'Cancelar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {rescheduleId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-300 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xl font-bold text-gray-900">Trocar horário</h4>
              <button
                onClick={() => setRescheduleId(null)}
                className="text-gray-500 hover:text-gray-700"
              >✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova data</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Novo horário</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  className="px-4 py-2 rounded-lg border border-gray-300"
                  onClick={() => setRescheduleId(null)}
                >
                  Fechar
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-pink-600 text-white font-semibold hover:bg-pink-700"
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/reschedule-requests', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ booking_id: rescheduleId, date: newDate, time: newTime }),
                      });
                      const data = await res.json();
                      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao solicitar troca');
                      setRequests(prev => ({ ...prev, [rescheduleId!]: { status: 'pending', requested_date: newDate, requested_time: `${newTime}:00` } }));
                      setRescheduleId(null);
                    } catch (e: any) {
                      alert(e?.message || 'Erro ao solicitar troca');
                    }
                  }}
                >
                  Enviar solicitação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientBookingsPage;


