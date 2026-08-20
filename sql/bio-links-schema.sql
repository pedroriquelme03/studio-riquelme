-- =====================================================================
-- Página /bio (link-in-bio) — botões dinâmicos do Studio Riquelme
-- Execute este arquivo no Supabase SQL Editor.
-- =====================================================================

-- Tabela de botões/links da página /bio
create table if not exists public.bio_links (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'link',   -- 'link' (botão clicável) ou 'header' (título de seção)
  title       text not null,
  subtitle    text,
  url         text,
  icon        text not null default 'link',    -- 'calendar' | 'whatsapp' | 'location' | 'link' | 'instagram'
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.bio_links is 'Botões/links exibidos na página pública /bio. Gerenciados pelo painel admin.';

create index if not exists bio_links_sort_idx on public.bio_links (sort_order);

alter table public.bio_links enable row level security;

drop policy if exists "Service role can manage bio_links" on public.bio_links;
create policy "Service role can manage bio_links" on public.bio_links
  for all using (true) with check (true);

-- ---------------------------------------------------------------------
-- Cabeçalho da página (título e descrição) guardados em system_settings.
-- A tabela system_settings já existe (system-settings-schema.sql).
-- ---------------------------------------------------------------------
insert into public.system_settings (key, value)
values
  ('bio_title', 'Studio Riquelme'),
  ('bio_subtitle', 'Beleza, cuidado e estilo em um só lugar.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Estrutura inicial de botões (só insere se a tabela estiver vazia).
-- Edite os textos, links e números de WhatsApp pelo painel admin.
-- ---------------------------------------------------------------------
insert into public.bio_links (kind, title, subtitle, url, icon, sort_order, is_active)
select * from (values
  ('link',   'Agendamento Online',        'Agende pelo nosso sistema, 24h',  'https://studioriquelme.com.br', 'calendar', 10, true),
  ('header', 'Agende pelo WhatsApp',      null,                              null,                            'whatsapp', 20, true),
  ('link',   'WhatsApp Bia Riquelme',     'Fale com a Bia',                  '',                              'whatsapp', 30, true),
  ('link',   'WhatsApp Ana Riquelme',     'Fale com a Ana',                  '',                              'whatsapp', 40, true),
  ('link',   'WhatsApp Livia',            'Fale com a Livia',                '',                              'whatsapp', 50, true),
  ('link',   'Endereço',                  'R. dos Golfinhos, 1166 - Parque Ouro Verde', 'https://maps.app.goo.gl/aazdYzCi2zsD8xK48', 'location', 60, true)
) as seed(kind, title, subtitle, url, icon, sort_order, is_active)
where not exists (select 1 from public.bio_links);
