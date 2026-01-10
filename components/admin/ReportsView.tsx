import React, { useEffect, useMemo, useState } from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

type BookingRow = {
  booking_id: string;
  date: string;  // yyyy-mm-dd
  time: string;  // HH:MM:SS
  total_price: string;
  services: Array<{ id: number; name: string; price: number; duration_minutes: number; quantity: number; }>;
};

const ReportsView: React.FC = () => {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [cancellations, setCancellations] = useState<Array<{ created_at: string; cancelled_by: 'client' | 'admin' }>>([]);

  const formatDate = (d: Date) => d.toISOString().slice(0,10);
  const startOfWeek = (d: Date) => {
    const day = (d.getDay() + 6) % 7;
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
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      // Se o usuário definir um período personalizado, tem prioridade
      if (customFrom && customTo) {
        qs.set('from', customFrom);
        qs.set('to', customTo);
      } else {
        if (view === 'day') {
          qs.set('from', formatDate(currentDate));
          qs.set('to', formatDate(currentDate));
        } else if (view === 'week') {
          qs.set('from', formatDate(startOfWeek(currentDate)));
          qs.set('to', formatDate(endOfWeek(currentDate)));
        } else {
          qs.set('from', formatDate(startOfMonth(currentDate)));
          qs.set('to', formatDate(endOfMonth(currentDate)));
        }
      }
      // Carregar bookings e cancelamentos em paralelo
      const [resB, resC] = await Promise.all([
        fetch(`/api/bookings?${qs.toString()}`),
        fetch(`/api/cancellations?${qs.toString()}&limit=1000`),
      ]);
      const [dataB, dataC] = await Promise.all([resB.json(), resC.json()]);
      if (!resB.ok) throw new Error(dataB?.error || 'Erro ao carregar relatórios (agendamentos)');
      if (!resC.ok) throw new Error(dataC?.error || 'Erro ao carregar relatórios (cancelamentos)');
      setBookings((dataB.bookings || []) as BookingRow[]);
      const cancelRows = Array.isArray(dataC?.cancellations) ? dataC.cancellations : [];
      setCancellations(cancelRows.map((r: any) => ({ created_at: r.created_at, cancelled_by: (r.cancelled_by || 'client') as 'client' | 'admin' })));
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [view, currentDate]);

  const totals = useMemo(() => {
    let count = bookings.length;
    let revenue = bookings.reduce((sum, b) => sum + Number(b.total_price || 0), 0);
    return { count, revenue };
  }, [bookings]);

  // Aggregations
  const byDay = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    bookings.forEach(b => {
      const k = b.date;
      const obj = map.get(k) || { count: 0, revenue: 0 };
      obj.count += 1;
      obj.revenue += Number(b.total_price || 0);
      map.set(k, obj);
    });
    const sorted = Array.from(map.entries()).sort(([a],[b]) => a.localeCompare(b));
    return {
      labels: sorted.map(([d]) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })),
      count: sorted.map(([,v]) => v.count),
      revenue: sorted.map(([,v]) => v.revenue),
    };
  }, [bookings]);

  const byService = useMemo(() => {
    const map = new Map<string, number>();
    bookings.forEach(b => {
      (b.services || []).forEach(s => {
        map.set(s.name, (map.get(s.name) || 0) + 1);
      });
    });
    const sorted = Array.from(map.entries()).sort((a,b) => b[1] - a[1]).slice(0, 8);
    return {
      labels: sorted.map(([name]) => name),
      data: sorted.map(([,n]) => n),
    };
  }, [bookings]);

  // Cancelamentos por dia (cliente x admin)
  const cancellationsByDay = useMemo(() => {
    const map = new Map<string, { total: number; client: number; admin: number }>();
    cancellations.forEach((c) => {
      const d = new Date(c.created_at);
      const key = d.toISOString().slice(0,10);
      const obj = map.get(key) || { total: 0, client: 0, admin: 0 };
      obj.total += 1;
      if (c.cancelled_by === 'admin') obj.admin += 1;
      else obj.client += 1;
      map.set(key, obj);
    });
    const sorted = Array.from(map.entries()).sort(([a],[b]) => a.localeCompare(b));
    return {
      labels: sorted.map(([d]) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })),
      client: sorted.map(([,v]) => v.client),
      admin: sorted.map(([,v]) => v.admin),
      total: sorted.map(([,v]) => v.total),
    };
  }, [cancellations]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">Relatórios</h2>
      <div className="flex flex-col md:flex-row md:items-center md:justify-center gap-3 mb-6">
        <div className="inline-flex rounded overflow-hidden border border-gray-300">
          <button onClick={() => setView('month')} className={`px-3 py-2 ${view==='month'?'bg-pink-600 text-white':'bg-white text-gray-700'}`}>Mês</button>
          <button onClick={() => setView('week')} className={`px-3 py-2 ${view==='week'?'bg-pink-600 text-white':'bg-white text-gray-700'}`}>Semana</button>
          <button onClick={() => setView('day')} className={`px-3 py-2 ${view==='day'?'bg-pink-600 text-white':'bg-white text-gray-700'}`}>Dia</button>
        </div>
        <div className="inline-flex items-center gap-2">
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-2 bg-gray-200 text-gray-900 rounded">Hoje</button>
          <button
            onClick={() => {
              const d = new Date(currentDate);
              if (view === 'day') d.setDate(d.getDate() - 1);
              else if (view === 'week') d.setDate(d.getDate() - 7);
              else d.setMonth(d.getMonth() - 1);
              setCurrentDate(d);
            }}
            className="px-3 py-2 bg-white text-gray-900 rounded border border-gray-300"
          >◀</button>
          <div className="text-gray-700 font-semibold min-w-[140px] text-center">
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
            className="px-3 py-2 bg-white text-gray-900 rounded border border-gray-300"
          >▶</button>
        </div>
        <div className="inline-flex items-end gap-2 border border-gray-300 rounded p-2 bg-white">
          <div>
            <label className="block text-xs text-gray-600 mb-1">De</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Até</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-gray-900"
            />
          </div>
          <button
            onClick={load}
            disabled={!customFrom || !customTo}
            className="px-3 py-2 bg-pink-600 disabled:bg-gray-400 text-white rounded"
            title="Aplicar período personalizado"
          >
            Aplicar
          </button>
          {(customFrom || customTo) && (
            <button
              onClick={() => { setCustomFrom(''); setCustomTo(''); load(); }}
              className="px-3 py-2 bg-gray-200 text-gray-900 rounded"
              title="Limpar período"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {error && <div className="text-red-400 mb-4">{error}</div>}
      {loading && <div className="text-gray-700">Carregando...</div>}

      {!loading && (
        <div className="grid gap-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-300 rounded-lg p-4">
              <h3 className="text-gray-900 font-semibold mb-3">Agendamentos por dia</h3>
              <Bar
                data={{
                  labels: byDay.labels,
                  datasets: [{ label: 'Agendamentos', data: byDay.count, backgroundColor: 'rgba(245, 158, 11, 0.5)', borderColor: '#f59e0b' }]
                }}
                options={{ responsive: true, plugins: { legend: { display: false } } }}
              />
            </div>
            <div className="bg-white border border-gray-300 rounded-lg p-4">
              <h3 className="text-gray-900 font-semibold mb-3">Receita por dia (R$)</h3>
              <Line
                data={{
                  labels: byDay.labels,
                  datasets: [{ label: 'Receita', data: byDay.revenue, borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.2)' }]
                }}
                options={{ responsive: true, plugins: { legend: { display: false } } }}
              />
            </div>
            <div className="bg-white border border-gray-300 rounded-lg p-4 md:col-span-2">
              <h3 className="text-gray-900 font-semibold mb-3">Cancelamentos por dia</h3>
              <Bar
                data={{
                  labels: cancellationsByDay.labels,
                  datasets: [
                    { label: 'Cliente', data: cancellationsByDay.client, backgroundColor: 'rgba(239, 68, 68, 0.5)', borderColor: '#ef4444', stack: 'canc' },
                    { label: 'Admin', data: cancellationsByDay.admin, backgroundColor: 'rgba(59, 130, 246, 0.5)', borderColor: '#3b82f6', stack: 'canc' },
                  ]
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { position: 'top' } },
                  scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } }
                }}
              />
            </div>
            <div className="bg-white border border-gray-300 rounded-lg p-4">
              <h3 className="text-gray-900 font-semibold mb-3">Serviços mais agendados</h3>
              <div className="h-64">
                <Doughnut
                  data={{
                    labels: byService.labels,
                    datasets: [{ data: byService.data, backgroundColor: ['#f59e0b','#84cc16','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#ef4444'] }]
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-300 rounded-lg p-4 text-center">
              <div className="text-gray-600 text-sm">Agendamentos</div>
              <div className="text-2xl font-bold text-gray-900">{totals.count}</div>
            </div>
            <div className="bg-white border border-gray-300 rounded-lg p-4 text-center">
              <div className="text-gray-600 text-sm">Receita (R$)</div>
              <div className="text-2xl font-bold text-pink-600">{totals.revenue.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsView;


