-- Contas fixas mensais (aluguel, internet, etc.)
-- Execute no Supabase SQL Editor

create table if not exists public.fixed_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric(10, 2) not null check (amount > 0),
  due_day smallint check (due_day is null or (due_day >= 1 and due_day <= 31)),
  allocation text not null default 'structure'
    check (allocation in ('structure', 'expense', 'product')),
  professional_id uuid null references public.professionals(id) on delete set null,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fixed_accounts_active on public.fixed_accounts(is_active);
create index if not exists idx_fixed_accounts_professional on public.fixed_accounts(professional_id);

comment on table public.fixed_accounts is 'Contas fixas mensais do salão ou por profissional';
comment on column public.fixed_accounts.allocation is 'structure = rateio do salão | expense = saída | product = estoque';

alter table public.fixed_accounts enable row level security;

drop policy if exists "Service role can manage fixed_accounts" on public.fixed_accounts;
create policy "Service role can manage fixed_accounts" on public.fixed_accounts
  for all using (true) with check (true);
