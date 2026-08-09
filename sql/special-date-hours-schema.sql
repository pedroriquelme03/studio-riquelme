-- Horários especiais por data (override do horário da semana para um dia ou período)
-- Execute no Supabase SQL Editor

create table if not exists public.special_date_hours (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  open_time time not null,
  close_time time not null,
  enabled boolean not null default true,
  professional_id uuid null references public.professionals(id) on delete cascade,
  created_at timestamptz default now()
);

create index if not exists idx_special_date_hours_date on public.special_date_hours(date);
create index if not exists idx_special_date_hours_professional on public.special_date_hours(professional_id);
-- `nulls not distinct` (PG15+) cobre também as linhas globais (professional_id NULL).
-- Um índice PARCIAL (`where professional_id is not null`) não serve aqui: além de
-- deixar as linhas globais sem proteção, o Postgres não consegue inferi-lo num
-- ON CONFLICT sem repetir o predicado WHERE — era a origem do erro 42P10.
create unique index if not exists idx_special_date_hours_date_prof on public.special_date_hours(date, professional_id) nulls not distinct;

comment on table public.special_date_hours is 'Horário especial de funcionamento para uma data específica; substitui o horário do dia da semana.';

alter table public.special_date_hours enable row level security;

drop policy if exists "Service role can manage special_date_hours" on public.special_date_hours;
create policy "Service role can manage special_date_hours" on public.special_date_hours
  for all using (true) with check (true);
