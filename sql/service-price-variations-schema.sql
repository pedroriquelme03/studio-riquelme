-- Variação de preço por serviço (extensível para outros tipos no futuro)

alter table public.services
  add column if not exists price_variation_enabled boolean not null default false,
  add column if not exists price_variation_type text;

create table if not exists public.service_price_variants (
  id uuid primary key default gen_random_uuid(),
  service_id integer not null references public.services(id) on delete cascade,
  variation_type text not null default 'hair_size',
  variant_key text not null,
  label text not null,
  price numeric(10, 2) not null check (price > 0),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (service_id, variation_type, variant_key)
);

create index if not exists service_price_variants_service_id_idx
  on public.service_price_variants(service_id);

alter table public.booking_services
  add column if not exists variation_type text,
  add column if not exists variant_key text,
  add column if not exists variant_label text;

-- unit_price já existe (promotions-schema.sql)
