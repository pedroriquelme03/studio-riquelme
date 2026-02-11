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
create unique index if not exists idx_special_date_hours_date_prof on public.special_date_hours(date, professional_id) where professional_id is not null;

comment on table public.special_date_hours is 'Horário especial de funcionamento para uma data específica; substitui o horário do dia da semana.';

alter table public.special_date_hours enable row level security;

drop policy if exists "Service role can manage special_date_hours" on public.special_date_hours;
create policy "Service role can manage special_date_hours" on public.special_date_hours
  for all using (true) with check (true);
