-- Planos mensais / assinaturas

alter table public.clients
  add column if not exists abacatepay_customer_id text;

create table if not exists public.monthly_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  monthly_price numeric(10, 2) not null check (monthly_price > 0),
  image_url text,
  benefits jsonb not null default '[]'::jsonb,
  rules_notes text not null default '',
  display_order integer not null default 0,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  abacatepay_product_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monthly_plan_services (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.monthly_plans(id) on delete cascade,
  service_id integer not null references public.services(id) on delete restrict,
  quantity_per_month integer not null check (quantity_per_month > 0),
  sort_order integer not null default 0,
  unique (plan_id, service_id)
);

create index if not exists monthly_plans_active_order_idx
  on public.monthly_plans (is_active, display_order, name);

create table if not exists public.client_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  plan_id uuid not null references public.monthly_plans(id) on delete restrict,
  status text not null default 'awaiting_payment',
  contracted_price numeric(10, 2) not null,
  plan_snapshot jsonb not null,
  abacatepay_checkout_id text,
  abacatepay_subscription_id text,
  abacatepay_customer_id text,
  subscribed_at timestamptz,
  last_payment_at timestamptz,
  next_billing_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_subscriptions_client_idx
  on public.client_subscriptions (client_id, created_at desc);

create index if not exists client_subscriptions_external_sub_idx
  on public.client_subscriptions (abacatepay_subscription_id);

create table if not exists public.subscription_benefit_cycles (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.client_subscriptions(id) on delete cascade,
  cycle_start date not null,
  cycle_end date not null,
  service_id integer not null references public.services(id),
  service_name text not null,
  quantity_allocated integer not null check (quantity_allocated > 0),
  quantity_used integer not null default 0 check (quantity_used >= 0),
  unique (subscription_id, cycle_start, service_id)
);

create table if not exists public.subscription_benefit_usage (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.subscription_benefit_cycles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  service_id integer not null references public.services(id),
  quantity integer not null default 1 check (quantity > 0),
  status text not null default 'reserved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.client_subscriptions(id) on delete set null,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.client_subscriptions(id) on delete cascade,
  amount numeric(10, 2),
  paid_at timestamptz,
  abacatepay_event_id text,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists public.abacatepay_webhook_events (
  id text primary key,
  event_type text not null,
  subscription_id uuid,
  processed_at timestamptz not null default now()
);

alter table public.booking_services
  add column if not exists subscription_benefit_usage_id uuid references public.subscription_benefit_usage(id);
