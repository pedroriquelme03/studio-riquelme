-- Limite de requisições e de tentativas de login (api/_lib/rate-limit.ts)
-- Execute no Supabase SQL Editor
--
-- Uma linha por chave (ex.: "login:admin:ip:1.2.3.4"). A função abaixo incrementa
-- o contador de forma atômica e diz se a requisição pode seguir.

create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now(),
  blocked_until timestamptz
);

create index if not exists idx_rate_limits_window_start on public.rate_limits(window_start);

comment on table public.rate_limits is 'Contadores de limite de requisições por IP/conta. Escrita apenas pela API (service role).';

-- RLS ligado e sem políticas: só a service role lê e grava.
alter table public.rate_limits enable row level security;

create or replace function public.rate_limit_hit(
  p_key text,
  p_limit integer,
  p_window_seconds integer,
  p_block_seconds integer default 0
)
returns table (allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rate_limits%rowtype;
  now_ts timestamptz := now();
  window_end timestamptz;
begin
  -- Limpeza ocasional de contadores antigos, para a tabela não crescer sem fim.
  if random() < 0.02 then
    delete from public.rate_limits
    where window_start < now_ts - interval '2 days'
      and (blocked_until is null or blocked_until < now_ts);
  end if;

  insert into public.rate_limits (key, count, window_start)
  values (p_key, 0, now_ts)
  on conflict (key) do nothing;

  select * into r from public.rate_limits where key = p_key for update;

  -- Ainda bloqueado.
  if r.blocked_until is not null and r.blocked_until > now_ts then
    return query select false, 0, ceil(extract(epoch from (r.blocked_until - now_ts)))::integer;
    return;
  end if;

  -- Janela expirada: recomeça a contagem.
  if r.window_start + make_interval(secs => p_window_seconds) <= now_ts then
    r.count := 0;
    r.window_start := now_ts;
  end if;

  r.count := r.count + 1;
  window_end := r.window_start + make_interval(secs => p_window_seconds);

  if r.count > p_limit then
    r.blocked_until := greatest(window_end, now_ts + make_interval(secs => p_block_seconds));
    update public.rate_limits
      set count = r.count, window_start = r.window_start, blocked_until = r.blocked_until
      where key = p_key;
    return query select false, 0, ceil(extract(epoch from (r.blocked_until - now_ts)))::integer;
    return;
  end if;

  update public.rate_limits
    set count = r.count, window_start = r.window_start, blocked_until = null
    where key = p_key;
  return query select true, p_limit - r.count, 0;
end;
$$;

-- A função roda com privilégios do dono: só a API (service role) pode chamá-la.
revoke all on function public.rate_limit_hit(text, integer, integer, integer) from public;
revoke all on function public.rate_limit_hit(text, integer, integer, integer) from anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer, integer) to service_role;
