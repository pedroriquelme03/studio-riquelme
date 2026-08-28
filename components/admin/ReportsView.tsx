import React, { useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type ExpenseCategory = 'expense' | 'product' | 'structure' | 'salary';

type ExpenseItem = {
  id: string;
  amount: number;
  description: string;
  expense_date: string;
  category: ExpenseCategory;
  created_at?: string;
};

type ProfessionalReport = {
  id: string;
  name: string;
  is_active: boolean;
  income: number;
  expenses: number;
  products: number;
  structure_share: number;
  pro_salao: number;
  salary: number;
  salon_remaining: number;
  balance: number;
  appointments: number;
  expense_items: ExpenseItem[];
  goals?: GoalProgress[];
};

type GoalMetric = 'appointments' | 'income';

type GoalProgress = {
  id: string;
  metric: GoalMetric;
  monthly_target: number;
  target: number;
  actual: number;
  progress_pct: number;
  period_month: string;
  professional_id: string | null;
  notes: string | null;
};

type GoalsSummary = {
  salon: GoalProgress[];
  by_professional: Record<string, GoalProgress[]>;
};

type PerformanceGoal = {
  id: string;
  professional_id: string | null;
  metric: GoalMetric;
  target_value: number;
  period_month: string;
  is_active: boolean;
  notes: string | null;
  professionals?: { id: string; name: string } | null;
};

type ReportTotals = {
  income: number;
  expenses: number;
  products: number;
  structure: number;
  pro_salao: number;
  salary: number;
  salon_remaining: number;
  balance: number;
  appointments: number;
};

type StructureInfo = {
  total: number;
  share_per_professional: number;
  professionals_count: number;
  items: ExpenseItem[];
};

type FixedAllocation = 'structure' | 'expense' | 'product';

type FixedAccount = {
  id: string;
  name: string;
  amount: number;
  due_day: number | null;
  allocation: FixedAllocation;
  professional_id: string | null;
  is_active: boolean;
  notes: string | null;
  professionals?: { id: string; name: string } | null;
};

type FixedAccountsSummary = {
  total: number;
  items: Array<{
    id: string;
    name: string;
    monthly_amount: number;
    period_amount: number;
    allocation: FixedAllocation;
    professional_id: string | null;
    due_day: number | null;
  }>;
};

type AdminProfessional = { id: string; name: string };

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  expense: 'Saída geral',
  product: 'Produto (estoque)',
  structure: 'Estrutura',
  salary: 'Salário',
};

const ALLOCATION_LABELS: Record<FixedAllocation, string> = {
  structure: 'Estrutura (rateio do salão)',
  expense: 'Saída geral',
  product: 'Produto (estoque)',
};

const GOAL_METRIC_LABELS: Record<GoalMetric, string> = {
  appointments: 'Atendimentos',
  income: 'Faturamento (atendimentos)',
};

const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const progressColor = (pct: number) => {
  if (pct >= 100) return 'bg-emerald-500';
  if (pct >= 70) return 'bg-gold';
  return 'bg-amber-600';
};

const GoalBar: React.FC<{ label: string; actual: number; target: number; pct: number; format?: 'money' | 'number' }> = ({
  label, actual, target, pct, format = 'money',
}) => (
  <div>
    <div className="flex justify-between text-xs text-zinc-400 mb-1">
      <span>{label}</span>
      <span>
        {format === 'money' ? money(actual) : actual} / {format === 'money' ? money(target) : target} ({pct}%)
      </span>
    </div>
    <div className="h-2 bg-surface-overlay rounded overflow-hidden">
      <div className={`h-full ${progressColor(pct)} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  </div>
);

const ReportsView: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [professionals, setProfessionals] = useState<ProfessionalReport[]>([]);
  const [totals, setTotals] = useState<ReportTotals>({
    income: 0, expenses: 0, products: 0, structure: 0, pro_salao: 0,
    salary: 0, salon_remaining: 0, balance: 0, appointments: 0,
  });
  const [structure, setStructure] = useState<StructureInfo>({
    total: 0, share_per_professional: 0, professionals_count: 0, items: [],
  });
  const [fixedAccountsSummary, setFixedAccountsSummary] = useState<FixedAccountsSummary>({ total: 0, items: [] });
  const [fixedAccounts, setFixedAccounts] = useState<FixedAccount[]>([]);
  const [adminProfessionals, setAdminProfessionals] = useState<AdminProfessional[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFixedForm, setShowFixedForm] = useState(false);
  const [editingFixedId, setEditingFixedId] = useState<string | null>(null);
  const [fixedName, setFixedName] = useState('');
  const [fixedAmount, setFixedAmount] = useState('');
  const [fixedDueDay, setFixedDueDay] = useState('');
  const [fixedAllocation, setFixedAllocation] = useState<FixedAllocation>('structure');
  const [fixedProfId, setFixedProfId] = useState('');
  const [fixedNotes, setFixedNotes] = useState('');
  const [fixedActive, setFixedActive] = useState(true);
  const [fixedSaving, setFixedSaving] = useState(false);
  const [goalsSummary, setGoalsSummary] = useState<GoalsSummary>({ salon: [], by_professional: {} });
  const [performanceGoals, setPerformanceGoals] = useState<PerformanceGoal[]>([]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalMonth, setGoalMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [goalMetric, setGoalMetric] = useState<GoalMetric>('appointments');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalProfId, setGoalProfId] = useState('');
  const [goalNotes, setGoalNotes] = useState('');
  const [goalActive, setGoalActive] = useState(true);
  const [goalSaving, setGoalSaving] = useState(false);

  const [entryCategory, setEntryCategory] = useState<ExpenseCategory>('expense');
  const [entryProfId, setEntryProfId] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryDescription, setEntryDescription] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [entrySaving, setEntrySaving] = useState(false);

  const formatDate = (d: Date) => d.toISOString().slice(0, 10);
  const startOfWeek = (d: Date) => {
    const day = (d.getDay() + 6) % 7;
    const r = new Date(d);
    r.setDate(d.getDate() - day);
    r.setHours(0, 0, 0, 0);
    return r;
  };
  const endOfWeek = (d: Date) => {
    const r = startOfWeek(d);
    r.setDate(r.getDate() + 6);
    return r;
  };
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

  const period = useMemo(() => {
    if (customFrom && customTo) return { from: customFrom, to: customTo };
    if (view === 'day') {
      const d = formatDate(currentDate);
      return { from: d, to: d };
    }
    if (view === 'week') {
      return { from: formatDate(startOfWeek(currentDate)), to: formatDate(endOfWeek(currentDate)) };
    }
    return { from: formatDate(startOfMonth(currentDate)), to: formatDate(endOfMonth(currentDate)) };
  }, [view, currentDate, customFrom, customTo]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ report: '1', from: period.from, to: period.to });
      const res = await fetch(`/api/professionals?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar relatórios');
      setProfessionals((data.professionals || []) as ProfessionalReport[]);
      setTotals(data.totals || {
        income: 0, expenses: 0, products: 0, structure: 0, pro_salao: 0,
        salary: 0, salon_remaining: 0, balance: 0, appointments: 0,
      });
      setStructure(data.structure || { total: 0, share_per_professional: 0, professionals_count: 0, items: [] });
      setFixedAccountsSummary(data.fixed_accounts || { total: 0, items: [] });
      setGoalsSummary(data.goals || { salon: [], by_professional: {} });
      if (!entryProfId && Array.isArray(data.professionals) && data.professionals.length) {
        const firstReal = data.professionals.find((p: ProfessionalReport) => p.id !== '__none__');
        if (firstReal) setEntryProfId(firstReal.id);
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, currentDate, customFrom, customTo]);

  const loadFixedAccounts = async () => {
    try {
      const [fixedRes, profRes] = await Promise.all([
        fetch('/api/professionals?fixed_accounts=1'),
        fetch('/api/professionals'),
      ]);
      const [fixedData, profData] = await Promise.all([fixedRes.json(), profRes.json()]);
      if (fixedRes.ok) setFixedAccounts((fixedData.fixed_accounts || []) as FixedAccount[]);
      if (profRes.ok) {
        setAdminProfessionals((profData.professionals || []).map((p: any) => ({ id: p.id, name: p.name })));
      }
    } catch {
      /* silencioso */
    }
  };

  useEffect(() => {
    loadFixedAccounts();
    loadPerformanceGoals();
  }, []);

  useEffect(() => {
    loadPerformanceGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalMonth]);

  useEffect(() => {
    if (!customFrom && !customTo && view === 'month') {
      const m = currentDate.getMonth() + 1;
      setGoalMonth(`${currentDate.getFullYear()}-${String(m).padStart(2, '0')}`);
    }
  }, [view, currentDate, customFrom, customTo]);

  const loadPerformanceGoals = async () => {
    try {
      const res = await fetch(`/api/professionals?goals=1&month=${encodeURIComponent(goalMonth)}`);
      const data = await res.json();
      if (res.ok) setPerformanceGoals((data.goals || []) as PerformanceGoal[]);
    } catch {
      /* silencioso */
    }
  };

  const resetGoalForm = () => {
    setEditingGoalId(null);
    setGoalMetric('appointments');
    setGoalTarget('');
    setGoalProfId('');
    setGoalNotes('');
    setGoalActive(true);
    setShowGoalForm(false);
  };

  const openEditGoal = (goal: PerformanceGoal) => {
    setEditingGoalId(goal.id);
    setGoalMonth(goal.period_month.slice(0, 7));
    setGoalMetric(goal.metric);
    setGoalTarget(String(goal.target_value));
    setGoalProfId(goal.professional_id || '');
    setGoalNotes(goal.notes || '');
    setGoalActive(goal.is_active);
    setShowGoalForm(true);
  };

  const saveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoalSaving(true);
    setError(null);
    try {
      const payload = {
        type: 'goal',
        id: editingGoalId || undefined,
        metric: goalMetric,
        target_value: Number(goalTarget),
        period_month: goalMonth,
        professional_id: goalProfId || null,
        notes: goalNotes.trim(),
        is_active: goalActive,
      };
      const res = await fetch('/api/professionals', {
        method: editingGoalId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao salvar meta');
      resetGoalForm();
      await Promise.all([loadPerformanceGoals(), load()]);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar meta');
    } finally {
      setGoalSaving(false);
    }
  };

  const removeGoal = async (id: string) => {
    if (!confirm('Excluir esta meta?')) return;
    setError(null);
    try {
      const res = await fetch(`/api/professionals?goal_id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao excluir meta');
      await Promise.all([loadPerformanceGoals(), load()]);
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir meta');
    }
  };

  const salonIncomeGoal = goalsSummary.salon.find((g) => g.metric === 'income');
  const salonAppointmentsGoal = goalsSummary.salon.find((g) => g.metric === 'appointments');

  const resetFixedForm = () => {
    setEditingFixedId(null);
    setFixedName('');
    setFixedAmount('');
    setFixedDueDay('');
    setFixedAllocation('structure');
    setFixedProfId('');
    setFixedNotes('');
    setFixedActive(true);
    setShowFixedForm(false);
  };

  const openEditFixed = (account: FixedAccount) => {
    setEditingFixedId(account.id);
    setFixedName(account.name);
    setFixedAmount(String(account.amount));
    setFixedDueDay(account.due_day ? String(account.due_day) : '');
    setFixedAllocation(account.allocation);
    setFixedProfId(account.professional_id || '');
    setFixedNotes(account.notes || '');
    setFixedActive(account.is_active);
    setShowFixedForm(true);
  };

  const saveFixedAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFixedSaving(true);
    setError(null);
    try {
      const payload = {
        type: 'fixed_account',
        id: editingFixedId || undefined,
        name: fixedName.trim(),
        amount: Number(fixedAmount),
        due_day: fixedDueDay ? Number(fixedDueDay) : null,
        allocation: fixedAllocation,
        professional_id: fixedAllocation === 'structure' ? null : (fixedProfId || null),
        notes: fixedNotes.trim(),
        is_active: fixedActive,
      };
      const res = await fetch('/api/professionals', {
        method: editingFixedId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao salvar conta fixa');
      resetFixedForm();
      await Promise.all([loadFixedAccounts(), load()]);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar conta fixa');
    } finally {
      setFixedSaving(false);
    }
  };

  const removeFixedAccount = async (id: string) => {
    if (!confirm('Excluir esta conta fixa?')) return;
    setError(null);
    try {
      const res = await fetch(`/api/professionals?fixed_account_id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao excluir conta fixa');
      await Promise.all([loadFixedAccounts(), load()]);
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir conta fixa');
    }
  };

  const chartData = useMemo(() => {
    const rows = professionals.filter((p) => p.id !== '__none__');
    return {
      labels: rows.map((p) => p.name),
      proSalao: rows.map((p) => p.pro_salao),
      salary: rows.map((p) => p.salary),
    };
  }, [professionals]);

  const addEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (entryCategory !== 'structure' && !entryProfId) return;
    setEntrySaving(true);
    setError(null);
    try {
      const res = await fetch('/api/professionals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'expense',
          category: entryCategory,
          professional_id: entryCategory === 'structure' ? null : entryProfId,
          amount: Number(entryAmount),
          description: entryDescription,
          expense_date: entryDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao registrar movimentação');
      setEntryAmount('');
      setEntryDescription('');
      await load();
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar movimentação');
    } finally {
      setEntrySaving(false);
    }
  };

  const removeEntry = async (entryId: string) => {
    if (!confirm('Remover este lançamento?')) return;
    setError(null);
    try {
      const res = await fetch(`/api/professionals?expense_id=${encodeURIComponent(entryId)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao remover lançamento');
      await load();
    } catch (err: any) {
      setError(err.message || 'Erro ao remover lançamento');
    }
  };

  const selectableProfessionals = professionals.filter((p) => p.id !== '__none__');
  const needsProfessional = entryCategory !== 'structure';

  return (
    <div>
      <h2 className="text-2xl font-bold gold-text text-center mb-6">Relatórios</h2>

      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-center gap-3 mb-6">
        <div className="inline-flex rounded overflow-hidden border border-line self-center">
          <button onClick={() => setView('month')} className={`px-3 py-2 ${view === 'month' ? 'bg-gold text-white' : 'bg-surface-raised text-zinc-200'}`}>Mês</button>
          <button onClick={() => setView('week')} className={`px-3 py-2 ${view === 'week' ? 'bg-gold text-white' : 'bg-surface-raised text-zinc-200'}`}>Semana</button>
          <button onClick={() => setView('day')} className={`px-3 py-2 ${view === 'day' ? 'bg-gold text-white' : 'bg-surface-raised text-zinc-200'}`}>Dia</button>
        </div>

        <div className="inline-flex items-center gap-2 self-center">
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-2 bg-surface-muted text-white rounded">Hoje</button>
          <button onClick={() => { const d = new Date(currentDate); if (view === 'day') d.setDate(d.getDate() - 1); else if (view === 'week') d.setDate(d.getDate() - 7); else d.setMonth(d.getMonth() - 1); setCurrentDate(d); }} className="px-3 py-2 bg-surface-raised text-white rounded border border-line">◀</button>
          <div className="text-zinc-200 font-semibold min-w-[180px] text-center">
            {view === 'day' && currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            {view === 'week' && `${startOfWeek(currentDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - ${endOfWeek(currentDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
            {view === 'month' && currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </div>
          <button onClick={() => { const d = new Date(currentDate); if (view === 'day') d.setDate(d.getDate() + 1); else if (view === 'week') d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + 1); setCurrentDate(d); }} className="px-3 py-2 bg-surface-raised text-white rounded border border-line">▶</button>
        </div>

        <div className="border border-line rounded p-2 bg-surface-raised max-w-md mx-auto xl:mx-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-zinc-300 mb-1">De</label>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full bg-surface-overlay border border-line rounded px-2 py-1 text-white" />
            </div>
            <div>
              <label className="block text-xs text-zinc-300 mb-1">Até</label>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full bg-surface-overlay border border-line rounded px-2 py-1 text-white" />
            </div>
          </div>
          {(customFrom || customTo) && (
            <button onClick={() => { setCustomFrom(''); setCustomTo(''); }} className="mt-2 px-3 py-2 bg-surface-muted text-white rounded text-sm">Limpar período personalizado</button>
          )}
        </div>
      </div>

      <p className="text-center text-sm text-zinc-400 mb-6">
        Período: {new Date(period.from + 'T12:00:00').toLocaleDateString('pt-BR')} até {new Date(period.to + 'T12:00:00').toLocaleDateString('pt-BR')}
      </p>

      {error && <div className="text-red-400 mb-4">{error}</div>}
      {loading && <div className="text-zinc-200 mb-4">Carregando...</div>}

      {!loading && (
        <div className="grid gap-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-surface-raised border border-line rounded-lg p-4 text-center">
              <div className="text-zinc-300 text-sm">Entrou (total)</div>
              <div className="text-xl font-bold text-emerald-400">{money(totals.income)}</div>
              {salonIncomeGoal && (
                <div className="mt-2 text-left">
                  <GoalBar label="Meta faturamento" actual={salonIncomeGoal.actual} target={salonIncomeGoal.target} pct={salonIncomeGoal.progress_pct} />
                </div>
              )}
            </div>
            <div className="bg-surface-raised border border-line rounded-lg p-4 text-center">
              <div className="text-zinc-300 text-sm">Produtos (estoque)</div>
              <div className="text-xl font-bold text-orange-400">{money(totals.products)}</div>
            </div>
            <div className="bg-surface-raised border border-line rounded-lg p-4 text-center">
              <div className="text-zinc-300 text-sm">Estrutura (total)</div>
              <div className="text-xl font-bold text-amber-400">{money(structure.total)}</div>
              <div className="text-xs text-zinc-500 mt-1">{money(structure.share_per_professional)} / profissional</div>
            </div>
            <div className="bg-surface-raised border border-line rounded-lg p-4 text-center">
              <div className="text-zinc-300 text-sm">Pro Salão</div>
              <div className="text-xl font-bold text-gold">{money(totals.pro_salao)}</div>
            </div>
            <div className="bg-surface-raised border border-line rounded-lg p-4 text-center">
              <div className="text-zinc-300 text-sm">Salários pagos</div>
              <div className="text-xl font-bold text-red-400">{money(totals.salary)}</div>
            </div>
            <div className="bg-surface-raised border border-line rounded-lg p-4 text-center">
              <div className="text-zinc-300 text-sm">Sobra do salão</div>
              <div className={`text-xl font-bold ${totals.salon_remaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{money(totals.salon_remaining)}</div>
            </div>
            <div className="bg-surface-raised border border-line rounded-lg p-4 text-center">
              <div className="text-zinc-300 text-sm">Saídas gerais</div>
              <div className="text-xl font-bold text-red-300">{money(totals.expenses)}</div>
            </div>
            <div className="bg-surface-raised border border-line rounded-lg p-4 text-center">
              <div className="text-zinc-300 text-sm">Contas fixas (período)</div>
              <div className="text-xl font-bold text-sky-400">{money(fixedAccountsSummary.total)}</div>
            </div>
            <div className="bg-surface-raised border border-line rounded-lg p-4 text-center">
              <div className="text-zinc-300 text-sm">Agendamentos</div>
              <div className="text-xl font-bold gold-text">{totals.appointments}</div>
              {salonAppointmentsGoal && (
                <div className="mt-2 text-left">
                  <GoalBar label="Meta atendimentos" actual={salonAppointmentsGoal.actual} target={salonAppointmentsGoal.target} pct={salonAppointmentsGoal.progress_pct} format="number" />
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface-raised border border-line rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-white font-semibold">Metas do período</h3>
                <p className="text-xs text-zinc-400 mt-1">Defina metas mensais de atendimentos e faturamento para o salão ou por profissional.</p>
              </div>
              <button
                type="button"
                onClick={() => { resetGoalForm(); setShowGoalForm(true); }}
                className="px-4 py-2 bg-gold hover:brightness-110 text-white font-semibold rounded"
              >
                Nova meta
              </button>
            </div>

            {showGoalForm && (
              <form onSubmit={saveGoal} className="mb-4 p-4 border border-line rounded-lg bg-surface-overlay grid md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Mês</label>
                  <input type="month" value={goalMonth} onChange={(e) => setGoalMonth(e.target.value)} className="w-full bg-surface-raised border border-line rounded px-3 py-2 text-white" required />
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Métrica</label>
                  <select value={goalMetric} onChange={(e) => setGoalMetric(e.target.value as GoalMetric)} className="w-full bg-surface-raised border border-line rounded px-3 py-2 text-white">
                    <option value="appointments">Quantidade de atendimentos</option>
                    <option value="income">Valor recebido dos atendimentos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Meta {goalMetric === 'appointments' ? '(qtd.)' : '(R$)'}</label>
                  <input
                    type="number"
                    min="1"
                    step={goalMetric === 'appointments' ? '1' : '0.01'}
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    className="w-full bg-surface-raised border border-line rounded px-3 py-2 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Escopo</label>
                  <select value={goalProfId} onChange={(e) => setGoalProfId(e.target.value)} className="w-full bg-surface-raised border border-line rounded px-3 py-2 text-white">
                    <option value="">Salão (todos)</option>
                    {adminProfessionals.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-zinc-300 mb-1">Observações</label>
                  <input value={goalNotes} onChange={(e) => setGoalNotes(e.target.value)} className="w-full bg-surface-raised border border-line rounded px-3 py-2 text-white" />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input id="goal-active" type="checkbox" checked={goalActive} onChange={(e) => setGoalActive(e.target.checked)} />
                  <label htmlFor="goal-active" className="text-sm text-zinc-300">Ativa</label>
                </div>
                <div className="md:col-span-3 flex gap-2 justify-end">
                  <button type="button" onClick={resetGoalForm} className="px-4 py-2 border border-line rounded text-white">Cancelar</button>
                  <button type="submit" disabled={goalSaving} className="px-4 py-2 bg-gold text-white font-semibold rounded disabled:opacity-50">
                    {goalSaving ? 'Salvando...' : editingGoalId ? 'Atualizar' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            )}

            {performanceGoals.length === 0 ? (
              <p className="text-sm text-zinc-400">Nenhuma meta cadastrada para {new Date(goalMonth + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-400 border-b border-line">
                      <th className="text-left py-2 pr-3">Mês</th>
                      <th className="text-left py-2 pr-3">Escopo</th>
                      <th className="text-left py-2 pr-3">Métrica</th>
                      <th className="text-left py-2 pr-3">Meta mensal</th>
                      <th className="text-left py-2 pr-3">No período</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-right py-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceGoals.map((goal) => {
                      const progressList = goal.professional_id
                        ? (goalsSummary.by_professional[goal.professional_id] || [])
                        : goalsSummary.salon;
                      const progress = progressList.find((g) => g.id === goal.id);
                      return (
                        <tr key={goal.id} className="border-b border-line/60 text-zinc-200">
                          <td className="py-2 pr-3">{new Date(goal.period_month + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</td>
                          <td className="py-2 pr-3">{goal.professionals?.name || 'Salão'}</td>
                          <td className="py-2 pr-3">{GOAL_METRIC_LABELS[goal.metric]}</td>
                          <td className="py-2 pr-3">{goal.metric === 'income' ? money(Number(goal.target_value)) : Number(goal.target_value)}</td>
                          <td className="py-2 pr-3">
                            {progress ? (
                              <span className={progress.progress_pct >= 100 ? 'text-emerald-400' : 'text-gold'}>
                                {progress.progress_pct}% ({goal.metric === 'income' ? money(progress.actual) : progress.actual})
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-2">{goal.is_active ? <span className="text-emerald-400">Ativa</span> : <span className="text-zinc-500">Inativa</span>}</td>
                          <td className="py-2 text-right whitespace-nowrap">
                            <button onClick={() => openEditGoal(goal)} className="text-gold hover:underline mr-3">Editar</button>
                            <button onClick={() => removeGoal(goal.id)} className="text-red-400 hover:underline">Excluir</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-surface-raised border border-line rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-white font-semibold">Contas fixas</h3>
                <p className="text-xs text-zinc-400 mt-1">Cadastre despesas mensais recorrentes. O valor entra automaticamente no relatório do período.</p>
              </div>
              <button
                type="button"
                onClick={() => { resetFixedForm(); setShowFixedForm(true); }}
                className="px-4 py-2 bg-gold hover:brightness-110 text-white font-semibold rounded"
              >
                Nova conta fixa
              </button>
            </div>

            {showFixedForm && (
              <form onSubmit={saveFixedAccount} className="mb-4 p-4 border border-line rounded-lg bg-surface-overlay grid md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <label className="block text-xs text-zinc-300 mb-1">Nome</label>
                  <input value={fixedName} onChange={(e) => setFixedName(e.target.value)} placeholder="Ex.: Aluguel" className="w-full bg-surface-raised border border-line rounded px-3 py-2 text-white" required />
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Valor mensal (R$)</label>
                  <input type="number" min="0.01" step="0.01" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} className="w-full bg-surface-raised border border-line rounded px-3 py-2 text-white" required />
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Dia do vencimento</label>
                  <input type="number" min="1" max="31" value={fixedDueDay} onChange={(e) => setFixedDueDay(e.target.value)} placeholder="Opcional" className="w-full bg-surface-raised border border-line rounded px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Tipo</label>
                  <select value={fixedAllocation} onChange={(e) => setFixedAllocation(e.target.value as FixedAllocation)} className="w-full bg-surface-raised border border-line rounded px-3 py-2 text-white">
                    <option value="structure">Estrutura (rateio do salão)</option>
                    <option value="expense">Saída geral</option>
                    <option value="product">Produto (estoque)</option>
                  </select>
                </div>
                {fixedAllocation !== 'structure' && (
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Profissional</label>
                    <select value={fixedProfId} onChange={(e) => setFixedProfId(e.target.value)} className="w-full bg-surface-raised border border-line rounded px-3 py-2 text-white" required={fixedAllocation === 'product'}>
                      <option value="">{fixedAllocation === 'expense' ? 'Rateio do salão' : 'Selecione'}</option>
                      {adminProfessionals.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className={fixedAllocation === 'structure' ? 'md:col-span-2' : ''}>
                  <label className="block text-xs text-zinc-300 mb-1">Observações</label>
                  <input value={fixedNotes} onChange={(e) => setFixedNotes(e.target.value)} className="w-full bg-surface-raised border border-line rounded px-3 py-2 text-white" />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input id="fixed-active" type="checkbox" checked={fixedActive} onChange={(e) => setFixedActive(e.target.checked)} />
                  <label htmlFor="fixed-active" className="text-sm text-zinc-300">Ativa</label>
                </div>
                <div className="md:col-span-3 flex gap-2 justify-end">
                  <button type="button" onClick={resetFixedForm} className="px-4 py-2 border border-line rounded text-white">Cancelar</button>
                  <button type="submit" disabled={fixedSaving} className="px-4 py-2 bg-gold text-white font-semibold rounded disabled:opacity-50">
                    {fixedSaving ? 'Salvando...' : editingFixedId ? 'Atualizar' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            )}

            {fixedAccounts.length === 0 ? (
              <p className="text-sm text-zinc-400">Nenhuma conta fixa cadastrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-400 border-b border-line">
                      <th className="text-left py-2 pr-3">Nome</th>
                      <th className="text-left py-2 pr-3">Mensal</th>
                      <th className="text-left py-2 pr-3">No período</th>
                      <th className="text-left py-2 pr-3">Venc.</th>
                      <th className="text-left py-2 pr-3">Tipo</th>
                      <th className="text-left py-2 pr-3">Profissional</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-right py-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fixedAccounts.map((account) => {
                      const periodItem = fixedAccountsSummary.items.find((i) => i.id === account.id);
                      return (
                        <tr key={account.id} className="border-b border-line/60 text-zinc-200">
                          <td className="py-2 pr-3 font-medium text-white">{account.name}</td>
                          <td className="py-2 pr-3">{money(Number(account.amount))}</td>
                          <td className="py-2 pr-3 text-sky-300">{money(periodItem?.period_amount || 0)}</td>
                          <td className="py-2 pr-3">{account.due_day ? `Dia ${account.due_day}` : '—'}</td>
                          <td className="py-2 pr-3">{ALLOCATION_LABELS[account.allocation]}</td>
                          <td className="py-2 pr-3">{account.professionals?.name || (account.allocation === 'structure' || account.allocation === 'expense' ? 'Salão' : '—')}</td>
                          <td className="py-2">{account.is_active ? <span className="text-emerald-400">Ativa</span> : <span className="text-zinc-500">Inativa</span>}</td>
                          <td className="py-2 text-right whitespace-nowrap">
                            <button onClick={() => openEditFixed(account)} className="text-gold hover:underline mr-3">Editar</button>
                            <button onClick={() => removeFixedAccount(account.id)} className="text-red-400 hover:underline">Excluir</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {chartData.labels.length > 0 && (
            <div className="bg-surface-raised border border-line rounded-lg p-4">
              <h3 className="text-white font-semibold mb-3">Pro Salão x Salário por profissional</h3>
              <Bar
                data={{
                  labels: chartData.labels,
                  datasets: [
                    { label: 'Pro Salão (R$)', data: chartData.proSalao, backgroundColor: 'rgba(212, 175, 55, 0.55)', borderColor: '#d4af37' },
                    { label: 'Salário (R$)', data: chartData.salary, backgroundColor: 'rgba(248, 113, 113, 0.55)', borderColor: '#f87171' },
                  ],
                }}
                options={{ responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }}
              />
            </div>
          )}

          <div className="bg-surface-raised border border-line rounded-lg p-4">
            <h3 className="text-white font-semibold mb-2">Registrar movimentação</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Produto = estoque por profissional · Estrutura = valor do salão dividido entre todas · Salário = retirada do Pro Salão
            </p>
            <form onSubmit={addEntry} className="grid md:grid-cols-6 gap-3 items-end">
              <div>
                <label className="block text-xs text-zinc-300 mb-1">Tipo</label>
                <select value={entryCategory} onChange={(e) => setEntryCategory(e.target.value as ExpenseCategory)} className="w-full bg-surface-overlay border border-line rounded px-3 py-2 text-white">
                  <option value="expense">Saída geral</option>
                  <option value="product">Produto (estoque)</option>
                  <option value="structure">Estrutura (salão)</option>
                  <option value="salary">Salário</option>
                </select>
              </div>
              {needsProfessional && (
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Profissional</label>
                  <select value={entryProfId} onChange={(e) => setEntryProfId(e.target.value)} className="w-full bg-surface-overlay border border-line rounded px-3 py-2 text-white" required>
                    <option value="">Selecione</option>
                    {selectableProfessionals.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-zinc-300 mb-1">Valor (R$)</label>
                <input type="number" min="0.01" step="0.01" value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} className="w-full bg-surface-overlay border border-line rounded px-3 py-2 text-white" required />
              </div>
              <div>
                <label className="block text-xs text-zinc-300 mb-1">Data</label>
                <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full bg-surface-overlay border border-line rounded px-3 py-2 text-white" required />
              </div>
              <div className={needsProfessional ? '' : 'md:col-span-2'}>
                <label className="block text-xs text-zinc-300 mb-1">Descrição</label>
                <input type="text" value={entryDescription} onChange={(e) => setEntryDescription(e.target.value)} placeholder="Ex.: shampoo, aluguel..." className="w-full bg-surface-overlay border border-line rounded px-3 py-2 text-white" />
              </div>
              <button type="submit" disabled={entrySaving} className="bg-gold hover:brightness-110 text-white font-semibold px-4 py-2 rounded disabled:opacity-50">
                {entrySaving ? 'Salvando...' : 'Adicionar'}
              </button>
            </form>
          </div>

          {structure.items.length > 0 && (
            <div className="bg-surface-raised border border-line rounded-lg p-4">
              <h3 className="text-white font-semibold mb-3">Investimentos em estrutura (salão)</h3>
              <ul className="divide-y divide-line">
                {structure.items.map((item) => (
                  <li key={item.id} className="py-2 flex items-center justify-between text-sm">
                    <div>
                      <div className="text-white">{item.description || 'Estrutura'}</div>
                      <div className="text-zinc-400">{new Date(item.expense_date + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-amber-400 font-semibold">{money(item.amount)}</span>
                      <button onClick={() => removeEntry(item.id)} className="text-zinc-400 hover:text-red-400 text-xs">Remover</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4">
            {professionals.filter((p) => p.id !== '__none__').length === 0 && (
              <div className="text-zinc-300 text-center py-8">Nenhum dado no período selecionado.</div>
            )}
            {professionals.filter((p) => p.id !== '__none__').map((prof) => (
              <div key={prof.id} className="bg-surface-raised border border-line rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId((prev) => (prev === prof.id ? null : prof.id))}
                  className="w-full px-4 py-4 text-left hover:bg-surface-overlay transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold text-white">{prof.name}</div>
                      <div className="text-sm text-zinc-400">{prof.appointments} agendamento(s)</div>
                      {(prof.goals || []).length > 0 && (
                        <div className="mt-2 space-y-1 max-w-md">
                          {(prof.goals || []).map((g) => (
                            <GoalBar
                              key={g.id}
                              label={GOAL_METRIC_LABELS[g.metric]}
                              actual={g.actual}
                              target={g.target}
                              pct={g.progress_pct}
                              format={g.metric === 'income' ? 'money' : 'number'}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                      <div><div className="text-zinc-500 text-xs">Entrou</div><div className="font-bold text-emerald-400">{money(prof.income)}</div></div>
                      <div><div className="text-zinc-500 text-xs">Produto</div><div className="font-bold text-orange-400">{money(prof.products)}</div></div>
                      <div><div className="text-zinc-500 text-xs">Estrutura</div><div className="font-bold text-amber-400">{money(prof.structure_share)}</div></div>
                      <div><div className="text-zinc-500 text-xs">Pro Salão</div><div className="font-bold text-gold">{money(prof.pro_salao)}</div></div>
                      <div><div className="text-zinc-500 text-xs">Salário</div><div className="font-bold text-red-400">{money(prof.salary)}</div></div>
                      <div><div className="text-zinc-500 text-xs">Sobra</div><div className={`font-bold ${prof.salon_remaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{money(prof.salon_remaining)}</div></div>
                    </div>
                  </div>
                </button>

                {expandedId === prof.id && (
                  <div className="px-4 pb-4 border-t border-line">
                    <div className="mt-3 text-xs text-zinc-400 mb-2">
                      Pro Salão = Entrou − Saídas − Produtos − Cota de estrutura ({money(prof.structure_share)})
                    </div>
                    {prof.expense_items.length === 0 ? (
                      <p className="text-sm text-zinc-400">Nenhum lançamento neste período.</p>
                    ) : (
                      <ul className="divide-y divide-line">
                        {prof.expense_items.map((item) => (
                          <li key={item.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                            <div>
                              <div className="text-white font-medium">{item.description || CATEGORY_LABELS[item.category]}</div>
                              <div className="text-zinc-400">
                                {CATEGORY_LABELS[item.category]} · {new Date(item.expense_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-red-400 font-semibold">{money(item.amount)}</span>
                              <button onClick={() => removeEntry(item.id)} className="text-zinc-400 hover:text-red-400 text-xs">Remover</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsView;
