-- Momento em que o agendamento foi confirmado pelo salão (botão "Confirmar" do painel)
-- Execute no Supabase SQL Editor
--
-- NULL = ainda não confirmado. O painel exibe "✓ Confirmado" quando preenchido.

alter table public.bookings add column if not exists confirmed_at timestamptz;

comment on column public.bookings.confirmed_at is 'Quando o salão confirmou o horário ao cliente. NULL = pendente de confirmação.';
