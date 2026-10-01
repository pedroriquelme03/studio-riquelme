-- Origem de cada agendamento (tag exibida no painel)
-- Execute no Supabase SQL Editor
--
--   whatsapp_agent → agente de WhatsApp (n8n)
--   site           → cliente pelo site
--   professional   → lançado manualmente por um profissional logado no painel
--
-- Agendamentos anteriores ficam com NULL (origem desconhecida, sem tag).

alter table public.bookings add column if not exists source text;

alter table public.bookings drop constraint if exists bookings_source_check;
alter table public.bookings add constraint bookings_source_check
  check (source is null or source in ('whatsapp_agent', 'site', 'professional'));

comment on column public.bookings.source is 'Origem do agendamento: whatsapp_agent, site ou professional. Definida pela API, não pelo cliente.';
