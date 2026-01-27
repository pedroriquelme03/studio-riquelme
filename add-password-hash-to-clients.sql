-- Adicionar coluna password_hash à tabela clients se não existir
-- Execute este script no Supabase (SQL Editor)

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE public.clients 
    ADD COLUMN password_hash TEXT;
    
    COMMENT ON COLUMN public.clients.password_hash IS 'Hash SHA-256 da senha do cliente';
  END IF;
END $$;
