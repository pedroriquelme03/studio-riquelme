-- Notificações push do PWA do painel admin.
-- Novos agendamentos e lembrete cerca de 1 hora antes de cada atendimento.
-- Execute no Supabase SQL Editor.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admins(id) on delete cascade,
  professional_id uuid references public.professionals(id) on delete set null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_admin on public.push_subscriptions(admin_id);
create index if not exists idx_push_subscriptions_professional on public.push_subscriptions(professional_id);

create table if not exists public.push_reminder_sent (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
alter table public.push_reminder_sent enable row level security;

comment on table public.push_subscriptions is 'Inscrições Web Push do painel. professional_id nulo recebe todos os profissionais.';
comment on table public.push_reminder_sent is 'Lembrete de 1h já enviado para o agendamento. Apagado quando o horário muda.';

-- Token usado pelo agendador do banco para chamar o lembrete. Sem políticas: só a API (service role) e o postgres leem.
create table if not exists public.push_runtime (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.push_runtime enable row level security;

create or replace function public.invoke_push_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  token text;
begin
  select value into token from public.push_runtime where key = 'cron_token';
  if token is null or length(token) < 16 then
    return;
  end if;
  perform net.http_get(
    url := 'https://studioriquelme.com.br/api/notifications?job=reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || token),
    timeout_milliseconds := 15000
  );
exception when undefined_function or undefined_table then
  return;
end;
$$;

revoke all on function public.invoke_push_reminders() from public;
revoke all on function public.invoke_push_reminders() from anon, authenticated;

-- A cada 5 minutos, se pg_cron e pg_net estiverem ativos. Senão, o painel aberto dispara o lembrete.
do $$
declare
  existing_id bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     or not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise notice 'pg_cron ou pg_net ausente. Lembretes com o app fechado dependem dessas extensões.';
    return;
  end if;

  for existing_id in select jobid from cron.job where jobname = 'sr-push-reminders'
  loop
    perform cron.unschedule(existing_id);
  end loop;

  perform cron.schedule(
    'sr-push-reminders',
    '*/5 * * * *',
    'select public.invoke_push_reminders()'
  );
exception when others then
  raise notice 'Lembrete automático não agendado: %', sqlerrm;
end $$;
