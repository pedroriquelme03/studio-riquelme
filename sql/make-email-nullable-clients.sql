-- Tornar a coluna email opcional (nullable) na tabela clients
-- Execute este script no Supabase (SQL Editor)

ALTER TABLE public.clients 
ALTER COLUMN email DROP NOT NULL;

COMMENT ON COLUMN public.clients.email IS 'Email do cliente (opcional)';
