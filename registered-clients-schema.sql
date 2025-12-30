-- Criação da tabela de clientes registrados para login via WhatsApp
-- Execute este script no Supabase (SQL Editor)

-- Extensão necessária para gen_random_uuid()
create extension if not exists "pgcrypto";

create table if not exists public.registered_clients (
  id uuid primary key default gen_random_uuid(),
  client_id uuid null references public.clients(id) on delete set null,
  name text not null,
  phone text not null unique,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_login timestamptz
);

create index if not exists idx_registered_clients_phone on public.registered_clients(phone);

-- Trigger para updated_at
create or replace function update_registered_clients_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_registered_clients_updated_at on public.registered_clients;
create trigger trg_update_registered_clients_updated_at
before update on public.registered_clients
for each row
execute function update_registered_clients_updated_at();

-- RLS
alter table public.registered_clients enable row level security;
drop policy if exists "Registered clients readable" on public.registered_clients;
create policy "Registered clients readable" on public.registered_clients
  for select using (true);


