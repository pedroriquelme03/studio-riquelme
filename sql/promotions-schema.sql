-- Módulo de Promoções (pacotes sequenciais multi-profissional)
-- Execute no Supabase SQL Editor

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  kind text not null default 'temporary' check (kind in ('fixed', 'temporary')),
  total_price numeric(10, 2) not null check (total_price > 0),
  valid_from date,
  valid_until date,
  gap_minutes smallint not null default 0 check (gap_minutes >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.promotion_items (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  service_id integer not null references public.services(id) on delete restrict,
  professional_id uuid not null references public.professionals(id) on delete restrict,
  sort_order smallint not null check (sort_order >= 1),
  price_percent numeric(5, 2) not null check (price_percent > 0 and price_percent <= 100),
  created_at timestamptz not null default now(),
  unique (promotion_id, sort_order)
);

create index if not exists idx_promotions_active on public.promotions(is_active);
create index if not exists idx_promotion_items_promotion on public.promotion_items(promotion_id);

comment on table public.promotions is 'Promoções fixas ou temporárias com valor total e sequência de serviços';
comment on column public.promotions.kind is 'fixed = sem data limite | temporary = valid_from/valid_until';
comment on column public.promotion_items.price_percent is 'Percentual do total_price (soma dos itens deve ser 100)';

-- Colunas em bookings para vincular segmentos da promoção
alter table public.bookings add column if not exists promotion_id uuid references public.promotions(id) on delete set null;
alter table public.bookings add column if not exists promotion_group_id uuid;
alter table public.bookings add column if not exists segment_order smallint;
alter table public.bookings add column if not exists allocated_price numeric(10, 2);

create index if not exists idx_bookings_promotion_group on public.bookings(promotion_group_id);

-- Preço snapshot por serviço no agendamento
alter table public.booking_services add column if not exists unit_price numeric(10, 2);

alter table public.promotions enable row level security;
alter table public.promotion_items enable row level security;

drop policy if exists "Service role can manage promotions" on public.promotions;
create policy "Service role can manage promotions" on public.promotions
  for all using (true) with check (true);

drop policy if exists "Service role can manage promotion_items" on public.promotion_items;
create policy "Service role can manage promotion_items" on public.promotion_items
  for all using (true) with check (true);
