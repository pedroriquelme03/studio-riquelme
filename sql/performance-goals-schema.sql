-- Metas de desempenho (atendimentos e faturamento mensal)
-- Execute no Supabase SQL Editor

create table if not exists public.performance_goals (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid null references public.professionals(id) on delete cascade,
  metric text not null check (metric in ('appointments', 'income')),
  target_value numeric(12, 2) not null check (target_value > 0),
  period_month date not null,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uma meta por métrica / mês / escopo (salão ou profissional)
create unique index if not exists idx_performance_goals_unique
  on public.performance_goals (
    coalesce(professional_id, '00000000-0000-0000-0000-000000000000'::uuid),
    metric,
    period_month
  );

create index if not exists idx_performance_goals_month on public.performance_goals(period_month);
create index if not exists idx_performance_goals_professional on public.performance_goals(professional_id);

comment on table public.performance_goals is 'Metas mensais de atendimentos e faturamento (salão ou por profissional)';
comment on column public.performance_goals.professional_id is 'NULL = meta do salão inteiro';
comment on column public.performance_goals.metric is 'appointments = quantidade de atendimentos | income = valor recebido dos atendimentos';
comment on column public.performance_goals.period_month is 'Primeiro dia do mês da meta (ex.: 2026-08-01)';

alter table public.performance_goals enable row level security;

drop policy if exists "Service role can manage performance_goals" on public.performance_goals;
create policy "Service role can manage performance_goals" on public.performance_goals
  for all using (true) with check (true);
