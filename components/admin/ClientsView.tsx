import React, { useEffect, useMemo, useState } from 'react';
import { WhatsAppIcon, whatsAppNumber } from '../icons';

type ClientRow = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

type HistoryBooking = {
  booking_id: string;
  date: string;
  time: string;
  professional_id: string | null;
  professional_name: string | null;
  total_price: string;
  services: Array<{
    id: number;
    name: string;
    price: number;
    duration_minutes: number;
    quantity: number;
    variant_label?: string | null;
  }>;
  is_cancelled: boolean;
};

async function parseJsonResponse(res: Response): Promise<any> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      res.status >= 500
        ? `Erro do servidor (${res.status}). Tente novamente mais tarde.`
        : `Erro ${res.status}. Tente novamente.`,
    );
  }
}

function formatServiceLabel(s: HistoryBooking['services'][number]) {
  const qty = Number(s.quantity || 1) > 1 ? ` x${s.quantity}` : '';
  const variant = s.variant_label ? ` (${s.variant_label})` : '';
  return `${s.name}${variant}${qty}`;
}

function formatDatePt(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const ClientsView: React.FC = () => {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [history, setHistory] = useState<HistoryBooking[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadClients = async (q = search) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set('q', q.trim());
      const res = await fetch(`/api/clients${qs.toString() ? `?${qs}` : ''}`, {
        credentials: 'same-origin',
      });
      const data = await parseJsonResponse(res);
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Erro ao carregar clientes');
      setClients((data.clients || []) as ClientRow[]);
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar clientes');
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (clientId: string) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const qs = new URLSearchParams({ history: '1', client_id: clientId });
      const res = await fetch(`/api/clients?${qs.toString()}`, { credentials: 'same-origin' });
      const data = await parseJsonResponse(res);
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Erro ao carregar histórico');
      setSelectedClient((data.client || null) as ClientRow | null);
      setHistory((data.bookings || []) as HistoryBooking[]);
    } catch (e: any) {
      setHistoryError(e?.message || 'Erro ao carregar histórico');
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadClients(search);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openClient = (client: ClientRow) => {
    setSelectedId(client.id);
    setSelectedClient(client);
    loadHistory(client.id);
  };

  const closeHistory = () => {
    setSelectedId(null);
    setSelectedClient(null);
    setHistory([]);
    setHistoryError(null);
  };

  const stats = useMemo(() => {
    const active = history.filter((b) => !b.is_cancelled);
    const cancelled = history.filter((b) => b.is_cancelled);
    const totalSpent = active.reduce((sum, b) => sum + Number(b.total_price || 0), 0);
    return {
      total: history.length,
      active: active.length,
      cancelled: cancelled.length,
      totalSpent,
    };
  }, [history]);

  return (
    <div>
      <h2 className="text-2xl font-bold gold-text text-center mb-6">Clientes</h2>

      <div className="mb-6 max-w-xl mx-auto">
        <label className="block text-sm text-zinc-300 mb-1">Buscar cliente</label>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nome, WhatsApp ou e-mail..."
          className="w-full bg-surface-raised text-white border border-line rounded px-3 py-2"
        />
        <p className="text-xs text-zinc-400 mt-2 text-center">
          {loading ? 'Carregando...' : `${clients.length} cliente${clients.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {error && <div className="text-red-400 mb-4 text-center">{error}</div>}

      {!loading && clients.length === 0 && (
        <div className="text-zinc-300 text-center">Nenhum cliente encontrado.</div>
      )}

      <div className="hidden md:block bg-surface-raised border border-line rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-surface-muted/50">
            <tr>
              <th className="p-4 font-semibold">Nome</th>
              <th className="p-4 font-semibold">WhatsApp</th>
              <th className="p-4 font-semibold">E-mail</th>
              <th className="p-4 font-semibold">Cadastro</th>
              <th className="p-4 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {clients.map((client) => (
              <tr key={client.id} className="hover:bg-surface-muted/40">
                <td className="p-4 font-semibold text-white">{client.name}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2 text-zinc-200">
                    <span>{client.phone || '—'}</span>
                    {client.phone && (
                      <a
                        href={`https://wa.me/${whatsAppNumber(client.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-700 inline-flex"
                        title="Abrir WhatsApp"
                      >
                        <WhatsAppIcon className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </td>
                <td className="p-4 text-zinc-300">
                  {client.email && !String(client.email).includes('@temp.local') && !String(client.email).includes('@client.studioriquelme.local')
                    ? client.email
                    : '—'}
                </td>
                <td className="p-4 text-zinc-300">
                  {client.created_at ? new Date(client.created_at).toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="p-4 text-right">
                  <button
                    type="button"
                    onClick={() => openClient(client)}
                    className="px-3 py-1.5 rounded border border-line text-sm text-white hover:bg-surface-overlay"
                  >
                    Ver histórico
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {clients.map((client) => (
          <div key={client.id} className="bg-surface-raised border border-line rounded-lg p-4">
            <div className="font-semibold text-white">{client.name}</div>
            <div className="text-sm text-zinc-300 mt-1 flex items-center gap-2">
              <span>{client.phone || '—'}</span>
              {client.phone && (
                <a
                  href={`https://wa.me/${whatsAppNumber(client.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:text-green-700 inline-flex"
                >
                  <WhatsAppIcon className="w-5 h-5" />
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => openClient(client)}
              className="mt-3 w-full px-3 py-2 rounded border border-line text-sm text-white hover:bg-surface-overlay"
            >
              Ver histórico
            </button>
          </div>
        ))}
      </div>

      {selectedId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-surface-raised border border-line rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {selectedClient?.name || 'Cliente'}
                </h3>
                <div className="text-sm text-zinc-300 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {selectedClient?.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      {selectedClient.phone}
                      <a
                        href={`https://wa.me/${whatsAppNumber(selectedClient.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-700 inline-flex"
                      >
                        <WhatsAppIcon className="w-4 h-4" />
                      </a>
                    </span>
                  )}
                  {selectedClient?.email
                    && !String(selectedClient.email).includes('@temp.local')
                    && !String(selectedClient.email).includes('@client.studioriquelme.local')
                    && <span>{selectedClient.email}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={closeHistory}
                className="text-zinc-400 hover:text-white text-xl leading-none px-2"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
              <div className="bg-surface-overlay border border-line rounded-lg p-3">
                <div className="text-xs text-zinc-400">Agendamentos</div>
                <div className="text-lg font-bold text-white">{stats.total}</div>
              </div>
              <div className="bg-surface-overlay border border-line rounded-lg p-3">
                <div className="text-xs text-zinc-400">Ativos</div>
                <div className="text-lg font-bold text-gold">{stats.active}</div>
              </div>
              <div className="bg-surface-overlay border border-line rounded-lg p-3">
                <div className="text-xs text-zinc-400">Cancelados</div>
                <div className="text-lg font-bold text-red-300">{stats.cancelled}</div>
              </div>
              <div className="bg-surface-overlay border border-line rounded-lg p-3">
                <div className="text-xs text-zinc-400">Total gasto</div>
                <div className="text-lg font-bold text-gold">
                  R$ {stats.totalSpent.toFixed(2)}
                </div>
              </div>
            </div>

            {historyLoading && <div className="text-zinc-300">Carregando histórico...</div>}
            {historyError && <div className="text-red-400 mb-3">{historyError}</div>}

            {!historyLoading && history.length === 0 && (
              <div className="text-zinc-300">Nenhum agendamento encontrado para este cliente.</div>
            )}

            <div className="space-y-3">
              {history.map((b) => (
                <div
                  key={b.booking_id}
                  className={`border rounded-lg p-4 ${
                    b.is_cancelled
                      ? 'border-red-900/60 bg-red-950/20'
                      : 'border-line bg-surface-overlay'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">
                        {formatDatePt(b.date)} · {String(b.time || '').slice(0, 5)}
                      </div>
                      <div className="text-sm text-zinc-300 mt-1">
                        {b.professional_name ? `Profissional: ${b.professional_name}` : 'Profissional: —'}
                      </div>
                      <div className="text-sm text-zinc-200 mt-1">
                        {(b.services || []).map(formatServiceLabel).join(', ') || 'Sem serviços'}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-gold">R$ {Number(b.total_price).toFixed(2)}</div>
                      {b.is_cancelled && (
                        <div className="text-xs text-red-300 mt-1 font-semibold">Cancelado</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsView;
