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
  const [requestsMap, setRequestsMap] = useState<Record<string, Array<{ id: string; status: string; requested_date: string; requested_time: string; created_at?: string; responded_at?: string }>>>({});

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
        // Buscar histórico de solicitações para estes agendamentos
        const ids = list.map(r => r.booking_id).join(',');
        if (ids) {
          try {
            const rRes = await fetch(`/api/reschedule-requests?booking_ids=${encodeURIComponent(ids)}`);
            const rData = await rRes.json();
            if (rRes.ok && Array.isArray(rData?.requests)) {
              const map: Record<string, Array<any>> = {};
              for (const req of rData.requests) {
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
            {/* Status e histórico das solicitações */}
            {(() => {
              const arr = requestsMap[r.booking_id] || [];
              if (!arr.length) return null;
              const current = arr[0];
              return (
                <div className="mt-2 text-sm space-y-2">
                  {current.status === 'pending' && (
                    <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      Solicitação enviada para {new Date(current.requested_date).toLocaleDateString('pt-BR')} às {current.requested_time?.slice(0,5)} — Aguardando aprovação
                    </div>
                  )}
                  {current.status === 'approved' && (
                    <div className="text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                      Solicitação aprovada! Novo horário confirmado para {new Date(current.requested_date).toLocaleDateString('pt-BR')} às {current.requested_time?.slice(0,5)}.
                    </div>
                  )}
                  {current.status === 'denied' && (
                    <div className="text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                      Solicitação negada.
                    </div>
                  )}
                  <details className="text-gray-700">
                    <summary className="cursor-pointer select-none">Histórico de solicitações</summary>
                    <ul className="mt-1 space-y-1">
                      {arr.map((q, idx) => (
                        <li key={q.id || idx} className="text-xs">
                          <span className="font-medium">{q.status.toUpperCase()}</span>
                          {' — '}
                          {new Date(q.requested_date).toLocaleDateString('pt-BR')} {q.requested_time?.slice(0,5)}
                          {q.responded_at ? ` (respondido em ${new Date(q.responded_at).toLocaleString('pt-BR')})` : ''}
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              );
            })()}
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
                      setRequestsMap(prev => {
                        const arr = prev[rescheduleId!] ? [...prev[rescheduleId!]] : [];
                        arr.unshift({
                          id: `temp-${Date.now()}`,
                          status: 'pending',
                          requested_date: newDate,
                          requested_time: `${newTime}:00`,
                        });
                        return { ...prev, [rescheduleId!]: arr };
                      });
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


