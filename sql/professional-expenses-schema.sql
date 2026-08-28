-- Despesas / movimentações financeiras (relatórios do painel)
-- Execute no Supabase SQL Editor

create table if not exists public.professional_expenses (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid null references public.professionals(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  description text,
  expense_date date not null default current_date,
  category text not null default 'expense',
  created_at timestamptz not null default now()
);

-- Migração para instalações já existentes
alter table public.professional_expenses
  alter column professional_id drop not null;

alter table public.professional_expenses
  add column if not exists category text not null default 'expense';

alter table public.professional_expenses
  drop constraint if exists professional_expenses_category_check;

alter table public.professional_expenses
  add constraint professional_expenses_category_check
  check (category in ('expense', 'product', 'structure', 'salary'));

create index if not exists idx_professional_expenses_professional on public.professional_expenses(professional_id);
create index if not exists idx_professional_expenses_date on public.professional_expenses(expense_date);
create index if not exists idx_professional_expenses_category on public.professional_expenses(category);

comment on table public.professional_expenses is 'Movimentações: expense (saída), product (estoque), structure (estrutura do salão), salary (salário)';
comment on column public.professional_expenses.category is 'expense | product | structure | salary. structure pode ter professional_id nulo (valor total do salão).';

alter table public.professional_expenses enable row level security;

drop policy if exists "Service role can manage professional_expenses" on public.professional_expenses;
create policy "Service role can manage professional_expenses" on public.professional_expenses
  for all using (true) with check (true);
