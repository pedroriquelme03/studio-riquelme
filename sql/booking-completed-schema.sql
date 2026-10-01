-- Marca quando o atendimento foi concluído (coluna "Atendidos" do Kanban).
alter table public.bookings add column if not exists completed_at timestamptz;

comment on column public.bookings.completed_at is 'Quando o salão marcou o atendimento como concluído. NULL = ainda não atendido.';
