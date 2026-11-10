-- Profissionais que não entram na soma dos relatórios de valores.
-- O faturamento continua visível no card, mas não é somado em Entrou, Pro Salão nem Sobra.
-- Execute no Supabase SQL Editor do projeto do estúdio.

alter table public.professionals
  add column if not exists include_in_reports boolean not null default true;

comment on column public.professionals.include_in_reports is
  'Quando false, o faturamento dos serviços deste profissional aparece no relatório, mas não entra nas somas.';
