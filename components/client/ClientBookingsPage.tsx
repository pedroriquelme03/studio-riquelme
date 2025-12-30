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
  const email = (typeof window !== 'undefined' && localStorage.getItem('client_email')) || '';

  useEffect(() => {
    (async () => {
      if (!email) return;
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ client: email });
        const res = await fetch(`/api/bookings?${qs.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Erro ao carregar agendamentos');
        setRows((data.bookings || []) as Row[]);
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar agendamentos');
      } finally {
        setLoading(false);
      }
    })();
  }, [email]);

  if (!email) {
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
      <p className="text-gray-600 mb-6">Conectado como <span className="font-semibold">{email}</span></p>

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
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClientBookingsPage;


