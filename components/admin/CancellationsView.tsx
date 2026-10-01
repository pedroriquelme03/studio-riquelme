import React, { useEffect, useState } from 'react';

type Professional = { id: string; name: string };

type CancellationRow = {
  id: string;
  at: string;
  booking_date: string;
  booking_time: string;
  client_name?: string;
  client_phone?: string;
};

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

function mapCancellationRows(rows: any[]): CancellationRow[] {
  return rows.map((r) => ({
    id: r.id,
    at: r.created_at,
    booking_date: r.bookings?.date,
    booking_time: r.bookings?.time,
    client_name: r.bookings?.clients?.name,
    client_phone: r.bookings?.clients?.phone,
  }));
}

const CANC_LIMIT = 20;

const CancellationsView: React.FC = () => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [professionalId, setProfessionalId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [cancellations, setCancellations] = useState<CancellationRow[]>([]);
  const [adminCancellations, setAdminCancellations] = useState<CancellationRow[]>([]);

  const [clientCancCursor, setClientCancCursor] = useState<string | null>(null);
  const [clientCancHasMore, setClientCancHasMore] = useState(true);
  const [clientCancLoadingMore, setClientCancLoadingMore] = useState(false);
  const [adminCancCursor, setAdminCancCursor] = useState<string | null>(null);
  const [adminCancHasMore, setAdminCancHasMore] = useState(true);
  const [adminCancLoadingMore, setAdminCancLoadingMore] = useState(false);
  const [visibleClientCount, setVisibleClientCount] = useState(3);
  const [visibleAdminCount, setVisibleAdminCount] = useState(3);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/professionals');
        if (!res.ok) return;
        const j = await parseJsonResponse(res).catch(() => ({}));
        setProfessionals((j.professionals || []).map((p: any) => ({ id: p.id, name: p.name })));
      } catch {
        // ignore
      }
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    setVisibleClientCount(3);
    setVisibleAdminCount(3);
    try {
      const qsClient = new URLSearchParams();
      if (professionalId) qsClient.set('professional_id', professionalId);
      qsClient.set('cancelled_by', 'client');
      qsClient.set('limit', String(CANC_LIMIT));

      const qsAdmin = new URLSearchParams();
      if (professionalId) qsAdmin.set('professional_id', professionalId);
      qsAdmin.set('cancelled_by', 'admin');
      qsAdmin.set('limit', String(CANC_LIMIT));

      const [cRes, aRes] = await Promise.all([
        fetch(`/api/cancellations?${qsClient.toString()}`),
        fetch(`/api/cancellations?${qsAdmin.toString()}`),
      ]);
      const [cData, aData] = await Promise.all([
        parseJsonResponse(cRes).catch(() => ({})),
        parseJsonResponse(aRes).catch(() => ({})),
      ]);

      if (cRes.ok && Array.isArray(cData?.cancellations)) {
        const rows = mapCancellationRows(cData.cancellations);
        setCancellations(rows);
        setClientCancCursor(rows.length ? rows[rows.length - 1].at : null);
        setClientCancHasMore(rows.length === CANC_LIMIT);
      } else {
        setCancellations([]);
        setClientCancCursor(null);
        setClientCancHasMore(false);
        if (!cRes.ok) throw new Error(cData?.error || 'Erro ao carregar cancelamentos dos clientes');
      }

      if (aRes.ok && Array.isArray(aData?.cancellations)) {
        const rows = mapCancellationRows(aData.cancellations);
        setAdminCancellations(rows);
        setAdminCancCursor(rows.length ? rows[rows.length - 1].at : null);
        setAdminCancHasMore(rows.length === CANC_LIMIT);
      } else {
        setAdminCancellations([]);
        setAdminCancCursor(null);
        setAdminCancHasMore(false);
        if (!aRes.ok) throw new Error(aData?.error || 'Erro ao carregar cancelamentos do admin');
      }
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar cancelamentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId]);

  const loadMore = async (
    kind: 'client' | 'admin',
  ) => {
    const isClient = kind === 'client';
    const list = isClient ? cancellations : adminCancellations;
    const visible = isClient ? visibleClientCount : visibleAdminCount;
    const hasMore = isClient ? clientCancHasMore : adminCancHasMore;
    const cursor = isClient ? clientCancCursor : adminCancCursor;
    const setVisible = isClient ? setVisibleClientCount : setVisibleAdminCount;
    const setLoadingMore = isClient ? setClientCancLoadingMore : setAdminCancLoadingMore;
    const setList = isClient ? setCancellations : setAdminCancellations;
    const setCursor = isClient ? setClientCancCursor : setAdminCancCursor;
    const setHasMore = isClient ? setClientCancHasMore : setAdminCancHasMore;

    if (visible < list.length) {
      setVisible(Math.min(visible + 3, list.length));
      return;
    }
    if (!hasMore) return;

    try {
      setLoadingMore(true);
      const qs = new URLSearchParams();
      if (professionalId) qs.set('professional_id', professionalId);
      qs.set('cancelled_by', kind);
      qs.set('limit', String(CANC_LIMIT));
      if (cursor) qs.set('to', cursor);
      const res = await fetch(`/api/cancellations?${qs.toString()}`);
      const j = await parseJsonResponse(res).catch(() => ({}));
      if (res.ok && Array.isArray(j?.cancellations)) {
        const rows = mapCancellationRows(j.cancellations);
        setList((prev) => [...prev, ...rows]);
        setCursor(rows.length ? rows[rows.length - 1].at : cursor);
        setHasMore(rows.length === CANC_LIMIT);
        setVisible((prev) => prev + 3);
      } else {
        setHasMore(false);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const renderList = (
    title: string,
    list: CancellationRow[],
    visibleCount: number,
    hasMore: boolean,
    loadingMore: boolean,
    onMore: () => void,
    onCollapse: () => void,
  ) => (
    <div className="mb-6 bg-surface-raised border border-line rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <button onClick={load} className="text-sm px-3 py-1 border border-line rounded hover:bg-surface-overlay text-white">
          Atualizar
        </button>
      </div>
      {list.length === 0 ? (
        <div className="text-zinc-300 text-sm mt-2">Nenhum cancelamento recente.</div>
      ) : (
        <>
          <div className="relative">
            <ul className="mt-2 divide-y divide-line pb-12">
              {list.slice(0, Math.min(visibleCount, list.length)).map((c) => (
                <li key={c.id} className="py-2 text-sm text-white flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{c.client_name || 'Cliente'}</div>
                    <div className="text-zinc-300">{c.client_phone || '-'}</div>
                  </div>
                  <div className="text-right">
                    <div>
                      {c.booking_date ? new Date(c.booking_date).toLocaleDateString('pt-BR') : '—'} às{' '}
                      {String(c.booking_time || '').slice(0, 5) || '—'}
                    </div>
                    <div className="text-xs text-zinc-400">
                      Cancelado em {c.at ? new Date(c.at).toLocaleString('pt-BR') : '—'}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {(list.length > visibleCount || hasMore) && (
              <div className="absolute inset-x-0 bottom-0 pb-2 pt-8 pointer-events-none">
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface-raised via-surface-raised/90 to-surface-raised/0" />
                <div className="relative flex justify-center pointer-events-auto pb-2">
                  <button
                    disabled={loadingMore}
                    onClick={onMore}
                    className="px-3 py-1.5 border border-line bg-surface-raised hover:bg-surface-overlay text-white rounded text-sm disabled:opacity-50"
                  >
                    {loadingMore ? 'Carregando...' : 'Ver mais'}
                  </button>
                </div>
              </div>
            )}
          </div>
          {list.length > 3 && visibleCount >= list.length && !hasMore && (
            <div className="mt-2 flex justify-center">
              <button
                onClick={onCollapse}
                className="px-3 py-1.5 border border-line bg-surface-raised hover:bg-surface-overlay text-white rounded text-sm"
              >
                Fechar
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div>
      <h2 className="text-2xl font-bold gold-text text-center mb-6">Cancelamentos</h2>

      <div className="mb-6 max-w-sm">
        <label className="block text-sm text-zinc-300 mb-1">Profissional</label>
        <select
          value={professionalId}
          onChange={(e) => setProfessionalId(e.target.value)}
          className="w-full bg-surface-raised text-white border border-line rounded px-3 py-2"
        >
          <option value="">Todos</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {error && <div className="text-red-400 mb-4">{error}</div>}
      {loading && <div className="text-zinc-200 mb-4">Carregando...</div>}

      {renderList(
        'Cancelamentos dos clientes',
        cancellations,
        visibleClientCount,
        clientCancHasMore,
        clientCancLoadingMore,
        () => loadMore('client'),
        () => setVisibleClientCount(3),
      )}

      {renderList(
        'Cancelamentos feitos pelo painel (admin)',
        adminCancellations,
        visibleAdminCount,
        adminCancHasMore,
        adminCancLoadingMore,
        () => loadMore('admin'),
        () => setVisibleAdminCount(3),
      )}
    </div>
  );
};

export default CancellationsView;
