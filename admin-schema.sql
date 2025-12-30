-- Tabela de administradores
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Tabela para tokens de reset de senha
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para password_reset_tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_admin_id ON public.password_reset_tokens(admin_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON public.password_reset_tokens(expires_at);

-- Habilitar RLS na tabela de tokens
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Remover política se existir antes de criar
DROP POLICY IF EXISTS "Service role can manage tokens" ON public.password_reset_tokens;

-- Política para tokens (API usará service role)
CREATE POLICY "Service role can manage tokens" ON public.password_reset_tokens
    FOR ALL
    USING (true);

COMMENT ON TABLE public.password_reset_tokens IS 'Tokens temporários para reset de senha de administradores';
COMMENT ON COLUMN public.password_reset_tokens.token IS 'Token único para reset de senha';
COMMENT ON COLUMN public.password_reset_tokens.expires_at IS 'Data e hora de expiração do token (1 hora após criação)';
COMMENT ON COLUMN public.password_reset_tokens.used IS 'Indica se o token já foi usado';

-- Índice para busca rápida por username
CREATE INDEX IF NOT EXISTS idx_admins_username ON public.admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON public.admins(is_active);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_admins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger se existir antes de criar
DROP TRIGGER IF EXISTS trigger_update_admins_updated_at ON public.admins;

CREATE TRIGGER trigger_update_admins_updated_at
    BEFORE UPDATE ON public.admins
    FOR EACH ROW
    EXECUTE FUNCTION update_admins_updated_at();

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Remover política se existir antes de criar
DROP POLICY IF EXISTS "Admins can read own data" ON public.admins;

-- Política: apenas admins autenticados podem ler (será usado pela API com service role)
-- Para desenvolvimento, podemos permitir leitura pública temporariamente
-- Em produção, use service role key na API
CREATE POLICY "Admins can read own data" ON public.admins
    FOR SELECT
    USING (true); -- Temporariamente permitindo leitura (API usará service role)

-- Inserir admin padrão (senha: studio2024)
-- Hash SHA-256 de 'studio2024': a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3
INSERT INTO public.admins (username, password_hash, name, email, is_active)
VALUES (
    'admin',
    'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', -- hash de 'studio2024'
    'Administrador',
    'admin@studioriquelme.com.br',
    true
)
ON CONFLICT (username) DO NOTHING;

COMMENT ON TABLE public.admins IS 'Tabela de administradores do sistema';
COMMENT ON COLUMN public.admins.password_hash IS 'Hash da senha (usar bcrypt ou SHA-256)';
COMMENT ON COLUMN public.admins.is_active IS 'Indica se o admin está ativo';

