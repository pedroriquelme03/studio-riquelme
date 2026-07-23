-- ============================================================================
-- ⚠️  JÁ APLICADO em 23/07/2026 no projeto Studio Riquelme (gfxspozoasywxyffcirt),
--     via as migrações add_client_password_resets_and_missing_columns,
--     fix_special_date_hours_unique_index e lockdown_rls_all_public_tables.
--     Este arquivo fica como referência e para recriar o ambiente do zero.
--     NÃO é necessário executá-lo de novo — é idempotente, mas desnecessário.
--
-- Correção de segurança — execute UMA VEZ no Supabase SQL Editor.
--
-- O que este script faz:
--   1. Cria a tabela de códigos de redefinição de senha do cliente (OTP).
--   2. Fecha a RLS: hoje as policies são `USING (true)`, o que deixa qualquer
--      pessoa com a chave anônima (que está no bundle JS público) ler a tabela
--      `admins` — incluindo password_hash — e escrever em `system_settings`
--      e `special_date_hours`.
--   3. Revoga os GRANTs de `anon`/`authenticated` nas tabelas de negócio.
--
-- Depois deste script, NENHUM acesso direto do navegador ao banco funciona.
-- Todo o acesso passa pelas rotas /api/*, que usam a service_role key e
-- ignoram RLS por definição. É exatamente esse o modelo desejado aqui.
-- ============================================================================

-- ── 1. Códigos de redefinição de senha do cliente ───────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.client_password_resets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  phone       text NOT NULL,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    integer NOT NULL DEFAULT 0,
  used        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_password_resets_phone
  ON public.client_password_resets(phone, used, created_at DESC);

COMMENT ON TABLE public.client_password_resets IS
  'Códigos OTP de 6 dígitos enviados por WhatsApp para redefinição de senha do cliente. Guardamos apenas o hash SHA-256 do código.';

-- Garante a coluna de senha do cliente (idempotente).
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS password_hash text;
COMMENT ON COLUMN public.clients.password_hash IS
  'Hash scrypt com salt (formato scrypt$N$salt$hash). Hashes SHA-256 legados são migrados no próximo login válido.';

-- Índice de apoio ao escopo por cliente usado pelas rotas /api.
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON public.bookings(client_id);

-- A API grava cancelled_at ao cancelar, mas a coluna não existia no banco:
-- o UPDATE falhava e o erro era apenas logado com console.warn.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- Índice único de special_date_hours: total, não parcial (ver comentário em
-- special-date-hours-schema.sql).
DROP INDEX IF EXISTS public.idx_special_date_hours_date_prof;
CREATE UNIQUE INDEX IF NOT EXISTS idx_special_date_hours_date_prof
  ON public.special_date_hours (date, professional_id) NULLS NOT DISTINCT;


-- ── 2. Remover as policies permissivas ──────────────────────────────────────

DROP POLICY IF EXISTS "Admins can read own data"            ON public.admins;
DROP POLICY IF EXISTS "Service role can manage tokens"      ON public.password_reset_tokens;
DROP POLICY IF EXISTS "Registered clients readable"         ON public.registered_clients;
DROP POLICY IF EXISTS "Service role can manage system_settings"    ON public.system_settings;
DROP POLICY IF EXISTS "Service role can manage special_date_hours" ON public.special_date_hours;


-- ── 3. Habilitar RLS e revogar acesso direto em todas as tabelas ────────────
-- RLS ativa + zero policies = nega tudo para anon/authenticated.
-- A service_role continua passando por cima da RLS, como esperado.

DO $$
DECLARE
  t text;
  alvos text[] := ARRAY[
    'admins',
    'password_reset_tokens',
    'clients',
    'client_password_resets',
    'registered_clients',
    'bookings',
    'booking_services',
    'booking_cancellations',
    'reschedule_requests',
    'services',
    'professionals',
    'business_hours',
    'manual_slots',
    'special_date_hours',
    'system_settings',
    'profiles'
  ];
BEGIN
  FOREACH t IN ARRAY alvos LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
      RAISE NOTICE 'Bloqueado: public.%', t;
    ELSE
      RAISE NOTICE 'Ignorado (não existe): public.%', t;
    END IF;
  END LOOP;
END $$;

-- Impede que novas tabelas nasçam abertas para a chave anônima.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;


-- ── 4. Verificação ──────────────────────────────────────────────────────────
-- Toda linha deve vir com rls_ativa = true e n_policies = 0.

SELECT
  c.relname                AS tabela,
  c.relrowsecurity         AS rls_ativa,
  count(p.polname)         AS n_policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public' AND c.relkind = 'r'
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;
