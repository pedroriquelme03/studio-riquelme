-- Memória de longo prazo do agente de WhatsApp: fatos e preferências por cliente
-- Execute no Supabase SQL Editor

create table if not exists public.agent_client_memories (
  id uuid primary key default gen_random_uuid(),
  phone text not null, -- DDD + número, só dígitos (mesmo formato de clients.phone)
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_client_memories_phone on public.agent_client_memories(phone, created_at);

comment on table public.agent_client_memories is 'Fatos e preferências que o agente de WhatsApp guarda sobre cada cliente, entre conversas.';

-- RLS ligado e sem políticas: só a service role (usada pela API) lê e grava.
-- Não crie política "using (true)" aqui — exporia as anotações à chave anônima.
alter table public.agent_client_memories enable row level security;
