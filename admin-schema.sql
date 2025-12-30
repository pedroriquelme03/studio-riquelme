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

CREATE TRIGGER trigger_update_admins_updated_at
    BEFORE UPDATE ON public.admins
    FOR EACH ROW
    EXECUTE FUNCTION update_admins_updated_at();

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

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

