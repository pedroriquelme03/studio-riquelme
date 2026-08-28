// Tipagens relaxadas para evitar dependência local de @vercel/node
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSession, requireAdmin } from './_lib/session.js';

const EXPENSE_CATEGORIES = ['expense', 'product', 'structure', 'salary'] as const;
type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

const FIXED_ALLOCATIONS = ['structure', 'expense', 'product'] as const;
type FixedAllocation = (typeof FIXED_ALLOCATIONS)[number];

const GOAL_METRICS = ['appointments', 'income'] as const;
type GoalMetric = (typeof GOAL_METRICS)[number];

function normalizeCategory(raw: unknown): ExpenseCategory {
	const value = String(raw || 'expense').toLowerCase();
	return (EXPENSE_CATEGORIES as readonly string[]).includes(value) ? (value as ExpenseCategory) : 'expense';
}

function normalizeAllocation(raw: unknown): FixedAllocation {
	const value = String(raw || 'structure').toLowerCase();
	return (FIXED_ALLOCATIONS as readonly string[]).includes(value) ? (value as FixedAllocation) : 'structure';
}

function normalizeGoalMetric(raw: unknown): GoalMetric {
	const value = String(raw || 'appointments').toLowerCase();
	return (GOAL_METRICS as readonly string[]).includes(value) ? (value as GoalMetric) : 'appointments';
}

/** Normaliza para o 1º dia do mês (YYYY-MM-01). */
function normalizePeriodMonth(raw: unknown): string | null {
	const value = String(raw || '').trim();
	if (!value) return null;
	const match = value.match(/^(\d{4})-(\d{2})/);
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
	return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
}

function lastDayOfMonth(year: number, monthIndex: number): number {
	return new Date(year, monthIndex + 1, 0).getDate();
}

/** Meta mensal proporcional ao trecho do mês que cai no intervalo do relatório. */
function prorateGoalForPeriod(monthlyTarget: number, periodMonth: string, from: string, to: string): number {
	const parts = periodMonth.slice(0, 10).split('-').map(Number);
	if (parts.length < 2) return 0;
	const year = parts[0];
	const monthIndex = parts[1] - 1;
	const monthStart = `${String(year).padStart(4, '0')}-${String(parts[1]).padStart(2, '0')}-01`;
	const monthEnd = `${String(year).padStart(4, '0')}-${String(parts[1]).padStart(2, '0')}-${String(lastDayOfMonth(year, monthIndex)).padStart(2, '0')}`;
	const overlapStart = from > monthStart ? from : monthStart;
	const overlapEnd = to < monthEnd ? to : monthEnd;
	if (overlapEnd < overlapStart) return 0;
	const msPerDay = 24 * 60 * 60 * 1000;
	const fromDate = new Date(`${overlapStart}T12:00:00`);
	const toDate = new Date(`${overlapEnd}T12:00:00`);
	const daysInOverlap = Math.floor((toDate.getTime() - fromDate.getTime()) / msPerDay) + 1;
	const daysInMonth = lastDayOfMonth(year, monthIndex);
	return Math.round((monthlyTarget * (daysInOverlap / daysInMonth)) * 100) / 100;
}

function monthsBetween(from: string, to: string): string[] {
	const start = normalizePeriodMonth(from);
	const end = normalizePeriodMonth(to);
	if (!start || !end) return [];
	const months: string[] = [];
	let y = Number(start.slice(0, 4));
	let m = Number(start.slice(5, 7));
	const endY = Number(end.slice(0, 4));
	const endM = Number(end.slice(5, 7));
	while (y < endY || (y === endY && m <= endM)) {
		months.push(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`);
		m += 1;
		if (m > 12) { m = 1; y += 1; }
	}
	return months;
}

function buildGoalProgress(
	goals: Array<any>,
	actualByScope: Map<string, { appointments: number; income: number }>,
	from: string,
	to: string,
) {
	const salon: Array<any> = [];
	const byProfessional: Record<string, Array<any>> = {};

	for (const goal of goals) {
		if (goal.is_active === false) continue;
		const metric = normalizeGoalMetric(goal.metric);
		const monthlyTarget = Number(goal.target_value || 0);
		if (monthlyTarget <= 0) continue;
		const periodMonth = String(goal.period_month || '').slice(0, 10);
		const proratedTarget = prorateGoalForPeriod(monthlyTarget, periodMonth, from, to);
		if (proratedTarget <= 0) continue;

		const profId = goal.professional_id ? String(goal.professional_id) : null;
		const scopeKey = profId || '__salon__';
		const actualRow = actualByScope.get(scopeKey) || { appointments: 0, income: 0 };
		const actual = metric === 'appointments' ? actualRow.appointments : actualRow.income;
		const progress_pct = proratedTarget > 0 ? Math.round((actual / proratedTarget) * 1000) / 10 : 0;

		const item = {
			id: goal.id,
			metric,
			monthly_target: monthlyTarget,
			target: proratedTarget,
			actual,
			progress_pct,
			period_month: periodMonth,
			professional_id: profId,
			notes: goal.notes || null,
		};

		if (profId) {
			if (!byProfessional[profId]) byProfessional[profId] = [];
			byProfessional[profId].push(item);
		} else {
			salon.push(item);
		}
	}

	return { salon, by_professional: byProfessional };
}

function sumByCategory(items: Array<{ category: ExpenseCategory; amount: number }>, category: ExpenseCategory) {
	return items.reduce((sum, item) => sum + (item.category === category ? Number(item.amount || 0) : 0), 0);
}

/** Valor mensal proporcional ao intervalo de datas do relatório. */
function prorateMonthlyAmount(monthlyAmount: number, from: string, to: string): number {
	const fromDate = new Date(`${from}T12:00:00`);
	const toDate = new Date(`${to}T12:00:00`);
	if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || toDate < fromDate) return 0;
	const msPerDay = 24 * 60 * 60 * 1000;
	const days = Math.floor((toDate.getTime() - fromDate.getTime()) / msPerDay) + 1;
	return Math.round((monthlyAmount * (days / 30)) * 100) / 100;
}

function isMissingTableError(message: string | undefined) {
	return /relation|does not exist|schema cache/i.test(message || '');
}

export default async function handler(req: any, res: any) {
	try {
		// Escrita é sempre do painel. O GET é público, mas email e telefone da
		// equipe só saem para admin — o site precisa apenas de id/nome/ativo.
		if (req.method !== 'GET' && !requireAdmin(req, res)) return;
		const isAdmin = getSession(req, 'admin')?.role === 'admin';

		const supabaseUrl =
			process.env.SUPABASE_URL ||
			process.env.VITE_SUPABASE_URL;
		const supabaseKey =
			process.env.SUPABASE_SERVICE_ROLE_KEY ||
			process.env.VITE_SUPABASE_ANON_KEY;
		if (!supabaseUrl || !supabaseKey) {
			return res.status(500).json({ ok: false, error: 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados' });
		}
		const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

		if (req.method === 'GET') {
			const urlObj = new URL(req?.url || '/', 'http://localhost');

			if (urlObj.searchParams.get('report') === '1') {
				if (!requireAdmin(req, res)) return;

				const from = urlObj.searchParams.get('from') || '';
				const to = urlObj.searchParams.get('to') || '';
				if (!from || !to) {
					return res.status(400).json({ ok: false, error: 'from e to são obrigatórios' });
				}

				const [{ data: professionals, error: profErr }, { data: bookings, error: bookErr }, { data: expenses, error: expErr }, { data: fixedAccounts, error: fixedErr }, { data: goals, error: goalsErr }] = await Promise.all([
					supabase.from('professionals').select('id, name, is_active').order('name', { ascending: true }),
					supabase
						.from('bookings')
						.select(`
							id,
							date,
							professional_id,
							booking_services ( quantity, unit_price, services:service_id ( price ) ),
							booking_cancellations ( id )
						`)
						.gte('date', from)
						.lte('date', to),
					supabase
						.from('professional_expenses')
						.select('id, professional_id, amount, description, expense_date, category, created_at')
						.gte('expense_date', from)
						.lte('expense_date', to)
						.order('expense_date', { ascending: false }),
					supabase
						.from('fixed_accounts')
						.select('id, name, amount, due_day, allocation, professional_id, is_active, notes')
						.eq('is_active', true),
					supabase
						.from('performance_goals')
						.select('id, professional_id, metric, target_value, period_month, is_active, notes')
						.in('period_month', monthsBetween(from, to))
						.eq('is_active', true),
				]);

				if (profErr) return res.status(500).json({ ok: false, error: profErr.message });
				if (bookErr) return res.status(500).json({ ok: false, error: bookErr.message });
				if (expErr && !isMissingTableError(expErr.message)) {
					return res.status(500).json({ ok: false, error: expErr.message });
				}
				if (fixedErr && !isMissingTableError(fixedErr.message)) {
					return res.status(500).json({ ok: false, error: fixedErr.message });
				}
				if (goalsErr && !isMissingTableError(goalsErr.message)) {
					return res.status(500).json({ ok: false, error: goalsErr.message });
				}

				const activeProfessionals = (professionals || []).filter((p: any) => p.is_active !== false);
				const splitCount = Math.max(activeProfessionals.length, 1);

				const incomeByProf = new Map<string, { income: number; appointments: number }>();
				const addIncome = (profId: string, value: number) => {
					const row = incomeByProf.get(profId) || { income: 0, appointments: 0 };
					row.income += value;
					row.appointments += 1;
					incomeByProf.set(profId, row);
				};

				for (const booking of bookings || []) {
					if (Array.isArray((booking as any).booking_cancellations) && (booking as any).booking_cancellations.length > 0) {
						continue;
					}
					const total = ((booking as any).booking_services || []).reduce((sum: number, bs: any) => {
						const unitPrice = bs?.unit_price != null
							? Number(bs.unit_price)
							: (() => {
								const svc = bs?.services;
								if (Array.isArray(svc)) {
									return svc.reduce((s: number, row: any) => s + Number(row?.price || 0), 0);
								}
								return Number(svc?.price || 0);
							})();
						return sum + unitPrice * Number(bs?.quantity ?? 1);
					}, 0);
					const profId = String((booking as any).professional_id || '__none__');
					addIncome(profId, total);
				}

				const entriesByProf = new Map<string, Array<any>>();
				const structureItems: Array<any> = [];
				let structureTotal = 0;

				for (const exp of expenses || []) {
					const category = normalizeCategory((exp as any).category);
					const item = {
						id: (exp as any).id,
						amount: Number((exp as any).amount || 0),
						description: (exp as any).description || '',
						expense_date: (exp as any).expense_date,
						category,
						created_at: (exp as any).created_at,
					};

					if (category === 'structure' && !(exp as any).professional_id) {
						structureTotal += item.amount;
						structureItems.push(item);
						continue;
					}

					const profId = String((exp as any).professional_id || '');
					if (!profId) continue;

					const list = entriesByProf.get(profId) || [];
					list.push(item);
					entriesByProf.set(profId, list);
				}

				const fixedAccountItems: Array<any> = [];
				let fixedAccountsTotal = 0;
				for (const account of fixedAccounts || []) {
					const monthly = Number((account as any).amount || 0);
					if (monthly <= 0) continue;
					const prorated = prorateMonthlyAmount(monthly, from, to);
					const allocation = normalizeAllocation((account as any).allocation);
					const profId = (account as any).professional_id ? String((account as any).professional_id) : null;
					const label = `[Conta fixa] ${String((account as any).name || 'Conta')}`;

					fixedAccountsTotal += prorated;
					fixedAccountItems.push({
						id: (account as any).id,
						name: (account as any).name,
						monthly_amount: monthly,
						period_amount: prorated,
						allocation,
						professional_id: profId,
						due_day: (account as any).due_day,
					});

					if (allocation === 'structure' || (allocation === 'expense' && !profId)) {
						structureTotal += prorated;
						structureItems.push({
							id: `fixed-${(account as any).id}`,
							amount: prorated,
							description: label,
							expense_date: from,
							category: 'structure',
							is_fixed: true,
						});
						continue;
					}

					if (!profId) continue;
					const category: ExpenseCategory = allocation === 'product' ? 'product' : 'expense';
					const list = entriesByProf.get(profId) || [];
					list.push({
						id: `fixed-${(account as any).id}`,
						amount: prorated,
						description: label,
						expense_date: from,
						category,
						is_fixed: true,
					});
					entriesByProf.set(profId, list);
				}

				const structureShare = structureTotal / splitCount;

				const actualByScope = new Map<string, { appointments: number; income: number }>();
				let salonAppointments = 0;
				let salonIncome = 0;
				for (const [profId, row] of incomeByProf.entries()) {
					salonAppointments += row.appointments;
					salonIncome += row.income;
					if (profId !== '__none__') {
						actualByScope.set(profId, { appointments: row.appointments, income: row.income });
					}
				}
				actualByScope.set('__salon__', { appointments: salonAppointments, income: salonIncome });

				const goalsProgress = buildGoalProgress(goals || [], actualByScope, from, to);

				const profRows = activeProfessionals.map((p: any) => {
					const incomeRow = incomeByProf.get(String(p.id)) || { income: 0, appointments: 0 };
					const items = entriesByProf.get(String(p.id)) || [];
					const expensesTotal = sumByCategory(items, 'expense');
					const productsTotal = sumByCategory(items, 'product');
					const salaryTotal = sumByCategory(items, 'salary');
					const proSalao = incomeRow.income - expensesTotal - productsTotal - structureShare;
					const salonRemaining = proSalao - salaryTotal;

					return {
						id: p.id,
						name: p.name,
						is_active: p.is_active,
						income: incomeRow.income,
						appointments: incomeRow.appointments,
						expenses: expensesTotal,
						products: productsTotal,
						structure_share: structureShare,
						pro_salao: proSalao,
						salary: salaryTotal,
						salon_remaining: salonRemaining,
						balance: proSalao,
						expense_items: items,
						goals: goalsProgress.by_professional[String(p.id)] || [],
					};
				});

				const noneIncome = incomeByProf.get('__none__') || { income: 0, appointments: 0 };
				if (noneIncome.income > 0 || noneIncome.appointments > 0) {
					profRows.push({
						id: '__none__',
						name: 'Sem profissional',
						is_active: true,
						income: noneIncome.income,
						appointments: noneIncome.appointments,
						expenses: 0,
						products: 0,
						structure_share: 0,
						pro_salao: noneIncome.income,
						salary: 0,
						salon_remaining: noneIncome.income,
						balance: noneIncome.income,
						expense_items: [],
					});
				}

				const totals = profRows.reduce(
					(acc, row) => ({
						income: acc.income + row.income,
						expenses: acc.expenses + row.expenses,
						products: acc.products + row.products,
						structure: acc.structure + row.structure_share,
						pro_salao: acc.pro_salao + row.pro_salao,
						salary: acc.salary + row.salary,
						salon_remaining: acc.salon_remaining + row.salon_remaining,
						balance: acc.balance + row.balance,
						appointments: acc.appointments + row.appointments,
					}),
					{
						income: 0,
						expenses: 0,
						products: 0,
						structure: 0,
						pro_salao: 0,
						salary: 0,
						salon_remaining: 0,
						balance: 0,
						appointments: 0,
					},
				);

				return res.status(200).json({
					ok: true,
					from,
					to,
					professionals: profRows,
					totals,
					structure: {
						total: structureTotal,
						share_per_professional: structureShare,
						professionals_count: splitCount,
						items: structureItems,
					},
					fixed_accounts: {
						total: fixedAccountsTotal,
						items: fixedAccountItems,
					},
					goals: goalsProgress,
				});
			}

			if (urlObj.searchParams.get('goals') === '1') {
				if (!requireAdmin(req, res)) return;
				const monthParam = urlObj.searchParams.get('month') || '';
				const periodMonth = normalizePeriodMonth(monthParam) || normalizePeriodMonth(new Date().toISOString().slice(0, 7));
				let query = supabase
					.from('performance_goals')
					.select('id, professional_id, metric, target_value, period_month, is_active, notes, created_at, updated_at, professionals:professional_id ( id, name )')
					.order('period_month', { ascending: false })
					.order('metric', { ascending: true });
				if (periodMonth) query = query.eq('period_month', periodMonth);
				const { data, error } = await query;
				if (error) {
					if (isMissingTableError(error.message)) {
						return res.status(200).json({ ok: true, goals: [] });
					}
					return res.status(500).json({ ok: false, error: error.message });
				}
				return res.status(200).json({ ok: true, goals: data || [], period_month: periodMonth });
			}

			if (urlObj.searchParams.get('fixed_accounts') === '1') {
				if (!requireAdmin(req, res)) return;
				const { data, error } = await supabase
					.from('fixed_accounts')
					.select('id, name, amount, due_day, allocation, professional_id, is_active, notes, created_at, updated_at, professionals:professional_id ( id, name )')
					.order('name', { ascending: true });
				if (error) {
					if (isMissingTableError(error.message)) {
						return res.status(200).json({ ok: true, fixed_accounts: [] });
					}
					return res.status(500).json({ ok: false, error: error.message });
				}
				return res.status(200).json({ ok: true, fixed_accounts: data || [] });
			}

			const columns = isAdmin
				? 'id, name, email, phone, is_active, created_at, updated_at'
				: 'id, name, is_active';

			let query = supabase.from('professionals').select(columns).order('name', { ascending: true });
			// Visitante só enxerga quem está ativo.
			if (!isAdmin) query = query.eq('is_active', true);

			const { data, error } = await query;
			if (error) return res.status(500).json({ ok: false, error: error.message });
			return res.status(200).json({ ok: true, professionals: data || [] });
		}

		if (req.method === 'POST') {
			const raw = req.body ?? {};
			const body = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;

			if (body?.type === 'expense') {
				const category = normalizeCategory(body?.category);
				const professional_id = body?.professional_id ? String(body.professional_id) : null;
				const amount = Number(body?.amount);
				const description = String(body?.description || '').trim();
				const expense_date = String(body?.expense_date || new Date().toISOString().slice(0, 10));

				if (category !== 'structure' && !professional_id) {
					return res.status(400).json({ ok: false, error: 'professional_id é obrigatório para esta categoria' });
				}
				if (!Number.isFinite(amount) || amount <= 0) {
					return res.status(400).json({ ok: false, error: 'amount deve ser maior que zero' });
				}

				const { data, error } = await supabase
					.from('professional_expenses')
					.insert({
						professional_id,
						amount,
						description: description || null,
						expense_date,
						category,
					})
					.select('id, professional_id, amount, description, expense_date, category, created_at')
					.single();

				if (error) {
					return res.status(500).json({ ok: false, error: error.message });
				}
				return res.status(201).json({ ok: true, expense: data });
			}

			if (body?.type === 'fixed_account') {
				const name = String(body?.name || '').trim();
				const amount = Number(body?.amount);
				const due_day = body?.due_day == null || body?.due_day === '' ? null : Number(body?.due_day);
				const allocation = normalizeAllocation(body?.allocation);
				const professional_id = body?.professional_id ? String(body.professional_id) : null;
				const is_active = body?.is_active !== false;
				const notes = String(body?.notes || '').trim();

				if (!name) return res.status(400).json({ ok: false, error: 'name é obrigatório' });
				if (!Number.isFinite(amount) || amount <= 0) {
					return res.status(400).json({ ok: false, error: 'amount deve ser maior que zero' });
				}
				if (allocation === 'product' && !professional_id) {
					return res.status(400).json({ ok: false, error: 'Produto fixo exige profissional' });
				}
				if (due_day != null && (!Number.isInteger(due_day) || due_day < 1 || due_day > 31)) {
					return res.status(400).json({ ok: false, error: 'due_day deve ser entre 1 e 31' });
				}

				const { data, error } = await supabase
					.from('fixed_accounts')
					.insert({
						name,
						amount,
						due_day,
						allocation,
						professional_id,
						is_active,
						notes: notes || null,
					})
					.select('id, name, amount, due_day, allocation, professional_id, is_active, notes, created_at, updated_at')
					.single();

				if (error) return res.status(500).json({ ok: false, error: error.message });
				return res.status(201).json({ ok: true, fixed_account: data });
			}

			if (body?.type === 'goal') {
				const metric = normalizeGoalMetric(body?.metric);
				const target_value = Number(body?.target_value ?? body?.amount);
				const period_month = normalizePeriodMonth(body?.period_month);
				const professional_id = body?.professional_id ? String(body.professional_id) : null;
				const is_active = body?.is_active !== false;
				const notes = String(body?.notes || '').trim();

				if (!period_month) {
					return res.status(400).json({ ok: false, error: 'period_month é obrigatório (YYYY-MM)' });
				}
				if (!Number.isFinite(target_value) || target_value <= 0) {
					return res.status(400).json({ ok: false, error: 'target_value deve ser maior que zero' });
				}
				if (metric === 'appointments' && !Number.isInteger(target_value)) {
					return res.status(400).json({ ok: false, error: 'Meta de atendimentos deve ser um número inteiro' });
				}

				const { data, error } = await supabase
					.from('performance_goals')
					.insert({
						professional_id,
						metric,
						target_value,
						period_month,
						is_active,
						notes: notes || null,
					})
					.select('id, professional_id, metric, target_value, period_month, is_active, notes, created_at, updated_at')
					.single();

				if (error) return res.status(500).json({ ok: false, error: error.message });
				return res.status(201).json({ ok: true, goal: data });
			}

			const { name, email, phone, is_active } = (body || {}) as {
				name?: string;
				email?: string;
				phone?: string;
				is_active?: boolean;
			};
			if (!name || !email || !phone) {
				return res.status(400).json({ ok: false, error: 'name, email e phone são obrigatórios' });
			}
			const { data, error } = await supabase
				.from('professionals')
				.insert({
					name, email, phone,
					is_active: typeof is_active === 'boolean' ? is_active : true,
				})
				.select('id, name, email, phone, is_active, created_at, updated_at')
				.single();
			if (error) return res.status(500).json({ ok: false, error: error.message });
			return res.status(201).json({ ok: true, professional: data });
		}

		if (req.method === 'PUT') {
			const raw = req.body ?? {};
			const body = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;

			if (body?.type === 'fixed_account') {
				const id = String(body?.id || '');
				const name = String(body?.name || '').trim();
				const amount = Number(body?.amount);
				const due_day = body?.due_day == null || body?.due_day === '' ? null : Number(body?.due_day);
				const allocation = normalizeAllocation(body?.allocation);
				const professional_id = body?.professional_id ? String(body.professional_id) : null;
				const is_active = body?.is_active !== false;
				const notes = String(body?.notes || '').trim();

				if (!id || !name) return res.status(400).json({ ok: false, error: 'id e name são obrigatórios' });
				if (!Number.isFinite(amount) || amount <= 0) {
					return res.status(400).json({ ok: false, error: 'amount deve ser maior que zero' });
				}
				if (allocation === 'product' && !professional_id) {
					return res.status(400).json({ ok: false, error: 'Produto fixo exige profissional' });
				}

				const { error } = await supabase
					.from('fixed_accounts')
					.update({
						name,
						amount,
						due_day,
						allocation,
						professional_id,
						is_active,
						notes: notes || null,
						updated_at: new Date().toISOString(),
					})
					.eq('id', id);
				if (error) return res.status(500).json({ ok: false, error: error.message });
				return res.status(200).json({ ok: true });
			}

			if (body?.type === 'goal') {
				const id = String(body?.id || '');
				const metric = normalizeGoalMetric(body?.metric);
				const target_value = Number(body?.target_value ?? body?.amount);
				const period_month = normalizePeriodMonth(body?.period_month);
				const professional_id = body?.professional_id ? String(body.professional_id) : null;
				const is_active = body?.is_active !== false;
				const notes = String(body?.notes || '').trim();

				if (!id || !period_month) {
					return res.status(400).json({ ok: false, error: 'id e period_month são obrigatórios' });
				}
				if (!Number.isFinite(target_value) || target_value <= 0) {
					return res.status(400).json({ ok: false, error: 'target_value deve ser maior que zero' });
				}
				if (metric === 'appointments' && !Number.isInteger(target_value)) {
					return res.status(400).json({ ok: false, error: 'Meta de atendimentos deve ser um número inteiro' });
				}

				const { error } = await supabase
					.from('performance_goals')
					.update({
						professional_id,
						metric,
						target_value,
						period_month,
						is_active,
						notes: notes || null,
						updated_at: new Date().toISOString(),
					})
					.eq('id', id);
				if (error) return res.status(500).json({ ok: false, error: error.message });
				return res.status(200).json({ ok: true });
			}

			const { id, name, email, phone, is_active } = (body || {}) as {
				id?: string;
				name?: string;
				email?: string;
				phone?: string;
				is_active?: boolean;
			};
			if (!id || !name || !email || !phone) {
				return res.status(400).json({ ok: false, error: 'id, name, email e phone são obrigatórios' });
			}
			const { error } = await supabase
				.from('professionals')
				.update({
					name, email, phone,
					is_active: typeof is_active === 'boolean' ? is_active : true,
					updated_at: new Date().toISOString(),
				})
				.eq('id', id);
			if (error) return res.status(500).json({ ok: false, error: error.message });
			return res.status(200).json({ ok: true });
		}

		if (req.method === 'DELETE') {
			const urlObj = new URL(req?.url || '/', 'http://localhost');
			const expenseId = urlObj.searchParams.get('expense_id');
			if (expenseId) {
				const { error } = await supabase.from('professional_expenses').delete().eq('id', expenseId);
				if (error) return res.status(500).json({ ok: false, error: error.message });
				return res.status(200).json({ ok: true });
			}

			const fixedAccountId = urlObj.searchParams.get('fixed_account_id');
			if (fixedAccountId) {
				const { error } = await supabase.from('fixed_accounts').delete().eq('id', fixedAccountId);
				if (error) return res.status(500).json({ ok: false, error: error.message });
				return res.status(200).json({ ok: true });
			}

			const goalId = urlObj.searchParams.get('goal_id');
			if (goalId) {
				const { error } = await supabase.from('performance_goals').delete().eq('id', goalId);
				if (error) return res.status(500).json({ ok: false, error: error.message });
				return res.status(200).json({ ok: true });
			}

			const id = urlObj.searchParams.get('id');
			if (!id) return res.status(400).json({ ok: false, error: 'id é obrigatório' });
			const { error } = await supabase.from('professionals').delete().eq('id', id);
			if (error) return res.status(500).json({ ok: false, error: error.message });
			return res.status(200).json({ ok: true });
		}

		res.setHeader('Allow', 'GET, POST, PUT, DELETE');
		return res.status(405).json({ ok: false, error: 'Método não permitido' });
	} catch (err: any) {
		return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
	}
}

