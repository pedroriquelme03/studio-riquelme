-- Tabela de configurações do sistema (key/value)
-- Usada por schedule-settings (booking_limit_month) e footer-contact (contatos do rodapé).
-- Execute no Supabase SQL Editor se a tabela ainda não existir.

create table if not exists public.system_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

comment on table public.system_settings is 'Configurações gerais: booking_limit_month, footer_contact1_name, footer_contact1_phone, footer_contact2_name, footer_contact2_phone, footer_address';

alter table public.system_settings enable row level security;

drop policy if exists "Service role can manage system_settings" on public.system_settings;
create policy "Service role can manage system_settings" on public.system_settings
  for all using (true) with check (true);
