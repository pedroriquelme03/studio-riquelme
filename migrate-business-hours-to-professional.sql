-- Migração: Adicionar suporte a horários por profissional
-- Este script adiciona a coluna professional_id à tabela business_hours

-- 1. Adicionar coluna professional_id (nullable para manter compatibilidade com horários globais)
ALTER TABLE public.business_hours 
ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE;

-- 2. Criar índice para melhorar performance nas consultas
CREATE INDEX IF NOT EXISTS idx_business_hours_professional_id ON public.business_hours(professional_id);
CREATE INDEX IF NOT EXISTS idx_business_hours_weekday_professional ON public.business_hours(weekday, professional_id);

-- 3. Atualizar constraint unique para permitir horários por profissional
-- Primeiro, remover a constraint antiga se existir
ALTER TABLE public.business_hours 
DROP CONSTRAINT IF EXISTS business_hours_weekday_key;

-- Criar nova constraint que permite múltiplos horários por weekday, mas apenas um por profissional
-- (ou um global se professional_id for NULL)
CREATE UNIQUE INDEX IF NOT EXISTS business_hours_weekday_professional_unique 
ON public.business_hours(weekday, COALESCE(professional_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 4. Comentário explicativo
COMMENT ON COLUMN public.business_hours.professional_id IS 
'ID do profissional. NULL significa horários globais (compatibilidade com versão anterior).';
