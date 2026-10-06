import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import KanbanCardMovement, {
  type KanbanCard,
  type KanbanColumn,
  type KanbanMove,
} from '../ui/KanbanCardMovement';

type BookingRow = {
  booking_id: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:MM:SS
  confirmed_at?: string | null;
  completed_at?: string | null;
  is_cancelled?: boolean;
  promotion_group_id?: string | null;
  client_name: string;
  client_notes?: string | null;
  services: Array<{
    id: number;
    name: string;
    quantity?: number;
    variant_label?: string | null;
  }>;
};

type ColumnId = 'solicitacoes' | 'confirmados' | 'atendidos' | 'cancelados';

const COLUMNS: KanbanColumn[] = [
  { id: 'solicitacoes', title: 'Solicitações' },
  { id: 'confirmados', title: 'Confirmados' },
  { id: 'atendidos', title: 'Atendidos' },
  { id: 'cancelados', title: 'Cancelados' },
];

const ORDER_STORAGE_KEY = 'studio-riquelme-kanban-order';
const MAX_ORDER_ENTRIES = 500;

/** Transições permitidas entre colunas (a API não tem "reabrir"). */
const ALLOWED_TRANSITIONS: Record<ColumnId, ColumnId[]> = {
  solicitacoes: ['confirmados', 'cancelados', 'atendidos'],
  confirmados: ['cancelados', 'atendidos'],
  atendidos: [],
  cancelados: [],
};

const COLUMN_LABEL: Record<ColumnId, string> = {
  solicitacoes: 'Solicitações',
  confirmados: 'Confirmados',
  atendidos: 'Atendidos',
  cancelados: 'Cancelados',
};

/** Erro interno usado para reverter o movimento sem exibir mensagem (ex.: usuário desistiu). */
class MoveAbortedError extends Error {}

async function parseJsonResponse(res: Response): Promise<any> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    const msg = res.ok
      ? 'Resposta inválida do servidor. Tente novamente.'
      : res.status >= 500
        ? `Erro do servidor (${res.status}). Tente novamente mais tarde.`
        : `Erro ${res.status}. Tente novamente.`;
    throw new Error(msg);
  }
}

function todayLocalISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Prioridade: cancelado > atendido > confirmado > solicitação. */
function columnOf(b: BookingRow): ColumnId {
  if (b.is_cancelled) return 'cancelados';
  if (b.completed_at) return 'atendidos';
  if (b.confirmed_at) return 'confirmados';
  return 'solicitacoes';
}

function serviceLabel(s: BookingRow['services'][number]): string {
  return s.variant_label ? `${s.name} (${s.variant_label})` : s.name;
}

function readStoredOrder(): Record<string, string[]> {
  try {
    const raw = window.localStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string[]> = {};
    for (const key of Object.keys(parsed)) {
      if (Array.isArray(parsed[key])) out[key] = parsed[key].filter((v: unknown) => typeof v === 'string');
    }
    return out;
  } catch {
    return {};
  }
}

function writeStoredOrder(order: Record<string, string[]>) {
  try {
    window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch {
    /* armazenamento indisponível: a ordem manual vale só nesta sessão */
  }
}

const KanbanView: React.FC = () => {
  const [dateFrom, setDateFrom] = useState<string>(todayLocalISO);
  const [dateTo, setDateTo] = useState<string>(todayLocalISO);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manualOrder, setManualOrder] = useState<Record<string, string[]>>(() => readStoredOrder());

  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  }, []);
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const loadBookings = useCallback(
    async (opts: { silent?: boolean; signal?: AbortSignal } = {}) => {
      if (!opts.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const qs = new URLSearchParams();
        if (dateFrom) qs.set('from', dateFrom);
        if (dateTo) qs.set('to', dateTo);
        qs.set('kanban', '1');
        const res = await fetch(`/api/bookings?${qs.toString()}`, {
          credentials: 'same-origin',
          signal: opts.signal,
        });
        const data = await parseJsonResponse(res);
        if (!res.ok) throw new Error(data?.error || 'Erro ao carregar agendamentos');
        if (opts.signal?.aborted) return;
        setBookings((data.bookings || []) as BookingRow[]);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        if (opts.silent) return; // o estado otimista já está na tela
        setError(e?.message || 'Erro ao carregar agendamentos');
      } finally {
        if (!opts.silent && !opts.signal?.aborted) setLoading(false);
      }
    },
    [dateFrom, dateTo],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadBookings({ signal: controller.signal });
    return () => controller.abort();
  }, [loadBookings]);

  const multiDay = dateFrom !== dateTo;

  /** Cartões por coluna, já ordenados: ordem manual salva primeiro, depois por horário. */
  const cardsByColumn = useMemo(() => {
    const byTime = [...bookings].sort(
      (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
    );
    const grouped: Record<ColumnId, BookingRow[]> = {
      solicitacoes: [],
      confirmados: [],
      atendidos: [],
      cancelados: [],
    };
    for (const b of byTime) grouped[columnOf(b)].push(b);

    (Object.keys(grouped) as ColumnId[]).forEach((col) => {
      const saved = manualOrder[col];
      if (!saved || saved.length === 0) return;
      const position = new Map(saved.map((id, i) => [id, i]));
      const withPos = grouped[col].filter((b) => position.has(b.booking_id));
      const withoutPos = grouped[col].filter((b) => !position.has(b.booking_id));
      withPos.sort((a, b) => position.get(a.booking_id)! - position.get(b.booking_id)!);
      grouped[col] = [...withPos, ...withoutPos];
    });
    return grouped;
  }, [bookings, manualOrder]);

  const cards: KanbanCard[] = useMemo(() => {
    const out: KanbanCard[] = [];
    (Object.keys(cardsByColumn) as ColumnId[]).forEach((col) => {
      cardsByColumn[col].forEach((b, index) => {
        const time = b.time.slice(0, 5);
        const when = multiDay ? `${b.date.slice(8, 10)}/${b.date.slice(5, 7)} ${time}` : time;
        const servicesLabel = (b.services || []).map(serviceLabel).join(', ');
        const notes = b.client_notes?.trim();
        const metaParts = [servicesLabel, notes ? `Obs.: ${notes}` : ''].filter(Boolean);
        out.push({
          id: b.booking_id,
          columnId: col,
          order: index,
          title: `${when} · ${b.client_name || 'Cliente'}`,
          meta: metaParts.length ? metaParts.join(' · ') : undefined,
        });
      });
    });
    return out;
  }, [cardsByColumn, multiDay]);

  // Refs para o handler de movimento ler sempre o estado mais recente.
  const cardsByColumnRef = useRef(cardsByColumn);
  cardsByColumnRef.current = cardsByColumn;
  const bookingsRef = useRef(bookings);
  bookingsRef.current = bookings;

  const saveOrder = useCallback((updates: Record<string, string[]>) => {
    setManualOrder((prev) => {
      const next = { ...prev };
      for (const col of Object.keys(updates)) next[col] = updates[col].slice(-MAX_ORDER_ENTRIES);
      writeStoredOrder(next);
      return next;
    });
  }, []);

  const moveValidation = useCallback(
    (fromColumn: string, toColumn: string): boolean | string => {
      const allowed = ALLOWED_TRANSITIONS[fromColumn as ColumnId]?.includes(toColumn as ColumnId);
      if (allowed) return true;
      const reason =
        fromColumn === 'atendidos' || fromColumn === 'cancelados'
          ? `Agendamentos em ${COLUMN_LABEL[fromColumn as ColumnId]} não podem ser movidos para outra coluna.`
          : `Não é possível mover de ${COLUMN_LABEL[fromColumn as ColumnId] ?? fromColumn} para ${COLUMN_LABEL[toColumn as ColumnId] ?? toColumn}.`;
      showNotice(reason);
      return reason;
    },
    [showNotice],
  );

  const handleMove = useCallback(
    async (move: KanbanMove) => {
      const lists: Record<string, string[]> = {};
      (Object.keys(cardsByColumnRef.current) as ColumnId[]).forEach((col) => {
        lists[col] = cardsByColumnRef.current[col].map((b) => b.booking_id);
      });

      // Mesma coluna: só reordena localmente (persistido no localStorage).
      if (move.fromColumn === move.toColumn) {
        const list = lists[move.fromColumn].filter((id) => id !== move.cardId);
        list.splice(Math.max(0, Math.min(move.toIndex, list.length)), 0, move.cardId);
        saveOrder({ [move.fromColumn]: list });
        return;
      }

      let status: 'confirmed' | 'cancelled' | 'completed';
      let body: Record<string, unknown>;
      if (move.toColumn === 'confirmados') {
        status = 'confirmed';
        body = { booking_id: move.cardId, status };
      } else if (move.toColumn === 'cancelados') {
        status = 'cancelled';
        body = { booking_id: move.cardId, status, cancelled_by: 'admin' };
      } else if (move.toColumn === 'atendidos') {
        status = 'completed';
        body = { booking_id: move.cardId, status };
      } else {
        throw new MoveAbortedError();
      }

      // Mesmo cuidado do botão "Cancelar": o cliente é avisado por WhatsApp.
      if (status === 'cancelled' && !window.confirm('Tem certeza que deseja cancelar este agendamento?')) {
        throw new MoveAbortedError();
      }

      try {
        const res = await fetch('/api/bookings', {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await parseJsonResponse(res);
        if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao atualizar o agendamento');
      } catch (e: any) {
        showNotice(e?.message || 'Erro ao atualizar o agendamento');
        throw e;
      }

      // Atualiza a classificação local (promoções movem a sequência inteira).
      const moved = bookingsRef.current.find((b) => b.booking_id === move.cardId);
      const groupId = moved?.promotion_group_id || null;
      const nowIso = new Date().toISOString();
      setBookings((prev) =>
        prev.map((b) => {
          const sameBooking = b.booking_id === move.cardId || (groupId && b.promotion_group_id === groupId);
          if (!sameBooking) return b;
          if (status === 'cancelled') return { ...b, is_cancelled: true };
          if (status === 'completed') return { ...b, completed_at: b.completed_at || nowIso };
          return { ...b, confirmed_at: b.confirmed_at || nowIso };
        }),
      );

      // Guarda a posição escolhida na coluna de destino e remove da de origem.
      const target = lists[move.toColumn].filter((id) => id !== move.cardId);
      target.splice(Math.max(0, Math.min(move.toIndex, target.length)), 0, move.cardId);
      saveOrder({
        [move.toColumn]: target,
        [move.fromColumn]: lists[move.fromColumn].filter((id) => id !== move.cardId),
      });

      // Sincroniza com o servidor sem piscar a tela.
      void loadBookings({ silent: true });
    },
    [loadBookings, saveOrder, showNotice],
  );

  const total = bookings.length;

  return (
    <div>
      <h2 className="text-2xl font-bold gold-text text-center mb-6">Kanban</h2>

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
        <div>
          <label className="block text-sm text-zinc-300 mb-1">Data de</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              const v = e.target.value;
              setDateFrom(v);
              if (v && dateTo && v > dateTo) setDateTo(v);
            }}
            className="w-full bg-surface-raised text-white border border-line rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-300 mb-1">Data até</label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full bg-surface-raised text-white border border-line rounded px-3 py-2"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            const today = todayLocalISO();
            setDateFrom(today);
            setDateTo(today);
          }}
          className="bg-surface-muted hover:bg-surface-overlay text-white font-semibold px-4 py-2 rounded transition-colors"
        >
          Hoje
        </button>
        <button
          type="button"
          onClick={() => loadBookings()}
          disabled={loading}
          className="bg-surface-muted hover:bg-surface-overlay disabled:opacity-50 text-white font-semibold px-4 py-2 rounded transition-colors"
        >
          Atualizar
        </button>
        <span className="text-sm text-zinc-400">
          Arraste os cartões entre as colunas ou use o botão de mover. A ordem dentro da coluna é por horário e pode ser ajustada manualmente.
        </span>
      </div>

      {error && <div className="text-red-400 mb-4">{error}</div>}
      {notice && (
        <div
          role="alert"
          className="mb-4 text-sm text-amber-300 bg-amber-950/40 border border-amber-800 rounded px-3 py-2 flex items-start justify-between gap-3"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-amber-300 hover:text-white"
            aria-label="Fechar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {loading && <div className="text-zinc-200 mb-4">Carregando...</div>}

      {!loading && !error && total === 0 && (
        <div className="text-zinc-300 mb-4">Nenhum agendamento no período selecionado.</div>
      )}

      <KanbanCardMovement
        label="Agendamentos"
        columns={COLUMNS}
        cards={cards}
        onMove={handleMove}
        moveValidation={moveValidation}
      />
    </div>
  );
};

export default KanbanView;
