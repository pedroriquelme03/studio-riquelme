# 🔐 Guia de Configuração do Sistema de Login
## Sistema de Agendamento SPA Vivaz Cataratas

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Pré-requisitos](#pré-requisitos)
3. [Configuração do Banco de Dados](#configuração-do-banco-de-dados)
4. [Variáveis de Ambiente](#variáveis-de-ambiente)
5. [Criação de Usuários Admin](#criação-de-usuários-admin)
6. [Sistema de Roles](#sistema-de-roles)
7. [Login de Clientes](#login-de-clientes)
8. [Testando o Sistema](#testando-o-sistema)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

O sistema possui **dois tipos de login**:

### 1. **Login Admin/Gerente/Colaborador**
- Acesso ao painel administrativo
- Autenticação via **username + senha**
- Sistema de roles (permissões diferenciadas)
- Rota: `/admin`

### 2. **Login Cliente**
- Acesso aos agendamentos pessoais
- Autenticação via **WhatsApp** (número de telefone)
- Rota: `/meus-agendamentos`

---

## ✅ Pré-requisitos

- ✅ Conta no [Supabase](https://supabase.com)
- ✅ Projeto Supabase criado
- ✅ PostgreSQL configurado
- ✅ Node.js 16+ instalado
- ✅ Git configurado

---

## 🗄️ Configuração do Banco de Dados

### **Passo 1: Criar Tabela de Admins**

No **Supabase SQL Editor**, execute o script `sql/admin-schema.sql`:

```sql
-- Criar tabela de administradores
CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(64) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  role VARCHAR(20) DEFAULT 'colaborador' CHECK (role IN ('admin', 'gerente', 'colaborador')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_admins_username ON public.admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_email ON public.admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON public.admins(is_active);

-- RLS (Row Level Security)
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Política para service_role (API)
DROP POLICY IF EXISTS "Service role can manage admins" ON public.admins;
CREATE POLICY "Service role can manage admins" ON public.admins
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

### **Passo 2: Criar Função de Hash de Senha**

Execute o script `criar-funcao-hash-senha.sql`:

```sql
-- Função para hash SHA-256 de senha
CREATE OR REPLACE FUNCTION hash_password(plain_password TEXT)
RETURNS VARCHAR(64) AS $$
BEGIN
  RETURN encode(digest(plain_password, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Comentário
COMMENT ON FUNCTION hash_password(TEXT) IS 'Gera hash SHA-256 de uma senha em texto plano';
```

### **Passo 3: Adicionar Campo Role (se ainda não existe)**

Execute o script `adicionar-campo-role.sql`:

```sql
-- Adicionar coluna role se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='admins' AND column_name='role'
  ) THEN
    ALTER TABLE public.admins ADD COLUMN role VARCHAR(20) DEFAULT 'colaborador';
  END IF;
END $$;

-- Adicionar constraint de validação
ALTER TABLE public.admins 
DROP CONSTRAINT IF EXISTS admins_role_check;

ALTER TABLE public.admins 
ADD CONSTRAINT admins_role_check 
CHECK (role IN ('admin', 'gerente', 'colaborador'));

-- Atualizar admins existentes sem role para 'admin'
UPDATE public.admins 
SET role = 'admin' 
WHERE role IS NULL;

-- Comentário
COMMENT ON COLUMN public.admins.role IS 'Tipo de usuário: admin (total), gerente (intermediário), colaborador (básico)';
```

### **Passo 4: Criar Tabela de Clientes**

```sql
-- Tabela de clientes (se ainda não existir)
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(100),
  room_number VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);

-- RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage clients" ON public.clients;
CREATE POLICY "Service role can manage clients" ON public.clients
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

### **Passo 5: Configurar Horários de Funcionamento**

Execute o script `business-hours-schema.sql`:

```sql
-- Criar tabela de horários de funcionamento
CREATE TABLE IF NOT EXISTS public.business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  period VARCHAR(20) NOT NULL CHECK (period IN ('morning', 'afternoon', 'evening')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(day_of_week, period)
);

-- RLS
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access to business hours" ON public.business_hours;
CREATE POLICY "Public read access to business hours" ON public.business_hours
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role can manage business hours" ON public.business_hours;
CREATE POLICY "Service role can manage business hours" ON public.business_hours
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Inserir horários padrão
INSERT INTO public.business_hours (day_of_week, period, is_active, start_time, end_time) VALUES
  -- Segunda a Sexta
  (1, 'morning', true, '09:00', '12:00'),
  (1, 'afternoon', true, '12:00', '18:00'),
  (1, 'evening', true, '18:00', '20:00'),
  (2, 'morning', true, '09:00', '12:00'),
  (2, 'afternoon', true, '12:00', '18:00'),
  (2, 'evening', true, '18:00', '20:00'),
  (3, 'morning', true, '09:00', '12:00'),
  (3, 'afternoon', true, '12:00', '18:00'),
  (3, 'evening', true, '18:00', '20:00'),
  (4, 'morning', true, '09:00', '12:00'),
  (4, 'afternoon', true, '12:00', '18:00'),
  (4, 'evening', true, '18:00', '20:00'),
  (5, 'morning', true, '09:00', '12:00'),
  (5, 'afternoon', true, '12:00', '18:00'),
  (5, 'evening', true, '18:00', '20:00'),
  -- Sábado (sem noite)
  (6, 'morning', true, '09:00', '12:00'),
  (6, 'afternoon', true, '12:00', '18:00'),
  (6, 'evening', false, '18:00', '20:00'),
  -- Domingo (fechado)
  (0, 'morning', false, '09:00', '12:00'),
  (0, 'afternoon', false, '12:00', '18:00'),
  (0, 'evening', false, '18:00', '20:00')
ON CONFLICT (day_of_week, period) DO NOTHING;
```

---

## 🔧 Variáveis de Ambiente

### **Passo 1: Arquivo `.env` (Local)**

Crie o arquivo `.env` na raiz do projeto:

```env
# Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-key-aqui

# Supabase Service Role (NUNCA exponha no frontend!)
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui

# PostgreSQL (Vercel/Neon)
POSTGRES_URL=sua-connection-string-postgresql
```

### **Passo 2: Onde Encontrar as Chaves**

#### **No Supabase Dashboard:**

1. Acesse: `https://supabase.com/dashboard/project/SEU_PROJETO_ID`
2. Vá em: **Settings** → **API**
3. Copie:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** → `VITE_SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **CUIDADO!**

#### **PostgreSQL Connection String:**

1. No Supabase: **Settings** → **Database**
2. Copie: **Connection string** → `POSTGRES_URL`
3. Ou use Vercel Postgres/Neon Database

### **Passo 3: Configurar no Vercel (Produção)**

1. Acesse: `https://vercel.com/seu-projeto/settings/environment-variables`
2. Adicione **todas** as variáveis acima
3. Selecione: **Production**, **Preview**, **Development**
4. Clique em **Save**

⚠️ **NUNCA** comite o arquivo `.env` no Git!

---

## 👤 Criação de Usuários Admin

### **Método 1: Via SQL (Recomendado para o primeiro admin)**

Execute no **Supabase SQL Editor**:

```sql
-- Criar primeiro usuário admin
INSERT INTO public.admins (username, name, email, password_hash, role, is_active)
VALUES (
  'admin',
  'Administrador',
  'admin@vivaz.com.br',
  hash_password('SuaSenhaSegura123!'),
  'admin',
  true
);

-- Verificar se foi criado
SELECT id, username, name, email, role, is_active, created_at 
FROM public.admins 
WHERE username = 'admin';
```

### **Método 2: Via Painel Admin (Após login)**

Após fazer login como admin:

1. Acesse: **Painel Admin** → **Usuários**
2. Clique em: **Adicionar Usuário**
3. Preencha:
   - **Username**: `joao.silva`
   - **Nome**: `João Silva`
   - **Email**: `joao@vivaz.com.br`
   - **Senha**: `senha123` (será hasheada automaticamente)
   - **Tipo**: Selecione `Admin`, `Gerente` ou `Colaborador`
4. Clique em: **Adicionar**

---

## 🔑 Sistema de Roles

### **Hierarquia de Permissões**

| Função | Descrição | Permissões |
|--------|-----------|------------|
| **Admin** | Acesso total | ✅ Gerenciar usuários<br>✅ Gerenciar serviços/profissionais<br>✅ Ver relatórios<br>✅ Gerenciar agendamentos<br>✅ Configurar horários<br>✅ Gerenciar banners |
| **Gerente** | Gestão operacional | ❌ Gerenciar usuários<br>✅ Gerenciar serviços/profissionais<br>✅ Ver relatórios<br>✅ Gerenciar agendamentos<br>✅ Configurar horários<br>✅ Gerenciar banners |
| **Colaborador** | Operação básica | ❌ Gerenciar usuários<br>❌ Gerenciar serviços/profissionais<br>❌ Ver relatórios<br>✅ Gerenciar agendamentos<br>❌ Configurar horários<br>❌ Gerenciar banners |

### **Alterar Role de um Usuário**

#### **Via SQL:**

```sql
-- Promover usuário a admin
UPDATE public.admins 
SET role = 'admin' 
WHERE username = 'joao.silva';

-- Rebaixar para colaborador
UPDATE public.admins 
SET role = 'colaborador' 
WHERE username = 'maria.santos';
```

#### **Via Painel Admin:**

1. Acesse: **Painel Admin** → **Usuários**
2. Clique em: **✏️ Editar** no usuário desejado
3. Altere o campo: **Tipo**
4. Clique em: **Salvar**

### **Verificar Roles**

```sql
-- Listar todos os usuários e seus roles
SELECT username, name, email, role, is_active 
FROM public.admins 
ORDER BY role, name;
```

---

## 📱 Login de Clientes

### **Como Funciona:**

1. Cliente acessa: `/` (página inicial)
2. Seleciona serviços e horário
3. Na tela de dados, insere:
   - **Nome**
   - **WhatsApp** (formato: `55 11 98765-4321`)
   - **Email** (opcional)
   - **Número da Acomodação** (4 dígitos)
4. Sistema verifica se o **WhatsApp já existe**:
   - ✅ **Existe**: Faz login automático
   - ❌ **Não existe**: Cria novo cliente e faz login
5. Redirecionado para: `/meus-agendamentos`

### **Verificar Clientes Cadastrados:**

```sql
-- Listar todos os clientes
SELECT id, name, phone, email, room_number, created_at 
FROM public.clients 
ORDER BY created_at DESC;
```

### **Buscar Cliente por WhatsApp:**

```sql
-- Buscar cliente específico
SELECT * FROM public.clients 
WHERE phone = '55 11 98765-4321';
```

---

## 🧪 Testando o Sistema

### **Teste 1: Login Admin**

1. Acesse: `http://localhost:5173/admin` (local) ou `https://seu-dominio.com/admin` (produção)
2. Digite:
   - **Usuário**: `admin`
   - **Senha**: `SuaSenhaSegura123!`
3. Clique em: **Entrar**
4. ✅ Você deve ser redirecionado para o painel admin
5. ✅ Verifique se o nome aparece no sidebar
6. ✅ Teste o botão de **Sair**

### **Teste 2: Permissões de Roles**

#### **Como Admin:**
1. Acesse: **Usuários**
2. ✅ Deve aparecer a lista de usuários
3. ✅ Deve conseguir adicionar/editar usuários

#### **Como Colaborador:**
1. Faça login com usuário colaborador
2. Acesse: **Usuários**
3. ✅ Deve aparecer: **"Acesso Negado - Apenas administradores podem gerenciar usuários"**

### **Teste 3: Login Cliente**

1. Acesse: `http://localhost:5173/`
2. Selecione: Serviço, Data, Horário
3. Clique em: **Próximo**
4. Preencha:
   - **Nome**: `João Teste`
   - **WhatsApp**: `55 11 99999-9999`
   - **Email**: `joao@teste.com`
   - **Acomodação**: `1234`
5. Clique em: **Confirmar Agendamento**
6. ✅ Deve ser redirecionado para: `/meus-agendamentos`
7. ✅ Deve aparecer: **"Olá João Teste"**
8. ✅ Deve listar o agendamento recém-criado

### **Teste 4: Horários de Funcionamento**

1. Como **admin** ou **gerente**, acesse: **Horários**
2. Desative: **Domingo → Manhã** (se não estiver desativado)
3. Como cliente, selecione um **domingo** no calendário
4. ✅ Deve aparecer: **"⚠️ Não há horários disponíveis neste dia"**

---

## 🔧 Troubleshooting

### **Problema 1: "Usuário ou senha inválidos"**

#### **Possíveis causas:**

1. ✅ **Senha incorreta**
   - Verifique se a senha está correta
   - Lembre-se: é case-sensitive (maiúsculas/minúsculas)

2. ✅ **Usuário não existe**
   ```sql
   -- Verificar se usuário existe
   SELECT * FROM public.admins WHERE username = 'seu-usuario';
   ```

3. ✅ **Usuário inativo**
   ```sql
   -- Ativar usuário
   UPDATE public.admins 
   SET is_active = true 
   WHERE username = 'seu-usuario';
   ```

4. ✅ **Hash de senha incorreto**
   ```sql
   -- Resetar senha
   UPDATE public.admins 
   SET password_hash = hash_password('NovaSenha123!') 
   WHERE username = 'seu-usuario';
   ```

### **Problema 2: "DATABASE_URL não configurada"**

#### **Solução:**

1. Verifique se as variáveis de ambiente estão configuradas:
   ```bash
   # Local
   cat .env | grep POSTGRES_URL
   
   # Vercel
   vercel env pull
   ```

2. No Vercel, verifique: **Settings** → **Environment Variables**

3. Adicione pelo menos uma dessas:
   - `POSTGRES_URL`
   - `DATABASE_URL`
   - `POSTGRES_PRISMA_URL`
   - `POSTGRES_URL_NON_POOLING`

### **Problema 3: "self-signed certificate in certificate chain"**

#### **Solução:**

Já corrigido nos arquivos:
- `api/client-auth.ts`
- `api/clients.ts`
- `api/bookings.ts`

Se ainda ocorrer, adicione ao arquivo de API:

```typescript
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
```

### **Problema 4: Função hash_password não existe**

#### **Erro:**
```
function hash_password(text) does not exist
```

#### **Solução:**

Execute o script `criar-funcao-hash-senha.sql` no Supabase SQL Editor.

### **Problema 5: "Acesso Negado" para Admin**

#### **Possíveis causas:**

1. ✅ **Role não está definida no banco**
   ```sql
   -- Verificar role do usuário
   SELECT username, role FROM public.admins WHERE username = 'seu-usuario';
   
   -- Definir como admin
   UPDATE public.admins 
   SET role = 'admin' 
   WHERE username = 'seu-usuario';
   ```

2. ✅ **API não está retornando o role**
   - Verifique se a coluna `role` existe na tabela `admins`
   - Execute: `adicionar-campo-role.sql`

3. ✅ **LocalStorage desatualizado**
   - Faça logout
   - Limpe o localStorage: `F12` → **Console** → `localStorage.clear()`
   - Faça login novamente

### **Problema 6: "Unexpected token 'A', 'A server e'... is not valid JSON"**

#### **Causa:**
API retornando HTML em vez de JSON.

#### **Solução:**

1. Verifique logs do Vercel: `vercel logs`
2. Procure por erros de sintaxe no arquivo de API
3. Verifique se todas as variáveis de ambiente estão configuradas

### **Problema 7: Cliente não consegue ver seus agendamentos**

#### **Solução:**

```sql
-- Verificar se cliente existe
SELECT * FROM public.clients WHERE phone = '55 11 99999-9999';

-- Verificar agendamentos do cliente
SELECT b.*, c.name as client_name 
FROM public.bookings b
JOIN public.clients c ON b.client_id = c.id
WHERE c.phone = '55 11 99999-9999';
```

---

## 📚 Arquivos de Referência

| Arquivo | Descrição |
|---------|-----------|
| `sql/admin-schema.sql` | Esquema da tabela de admins |
| `criar-funcao-hash-senha.sql` | Função para hash SHA-256 |
| `adicionar-campo-role.sql` | Adicionar coluna role |
| `criar-novo-usuario.sql` | Template para criar usuários |
| `business-hours-schema.sql` | Esquema de horários |
| `SISTEMA_ROLES.md` | Documentação de roles |
| `contexts/AuthContext.tsx` | Contexto de autenticação admin |
| `api/auth.ts` | API de autenticação admin |
| `api/client-auth.ts` | API de autenticação cliente |
| `hooks/usePermissions.ts` | Hook de permissões |

---

## 🎓 Comandos Úteis

### **Verificar Estrutura do Banco**

```sql
-- Listar colunas da tabela admins
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'admins'
ORDER BY ordinal_position;

-- Verificar constraints
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'admins';
```

### **Resetar Senha de Admin**

```sql
-- Via SQL
UPDATE public.admins 
SET password_hash = hash_password('NovaSenha123!') 
WHERE username = 'admin';
```

### **Listar Todos os Admins Ativos**

```sql
SELECT 
  username, 
  name, 
  email, 
  role,
  CASE 
    WHEN is_active THEN '✅ Ativo'
    ELSE '❌ Inativo'
  END as status,
  created_at
FROM public.admins
ORDER BY created_at DESC;
```

### **Contar Agendamentos por Cliente**

```sql
SELECT 
  c.name,
  c.phone,
  COUNT(b.id) as total_agendamentos
FROM public.clients c
LEFT JOIN public.bookings b ON c.id = b.client_id
GROUP BY c.id, c.name, c.phone
ORDER BY total_agendamentos DESC;
```

---

## ✅ Checklist Final

Antes de colocar em produção, verifique:

- [ ] ✅ Tabelas criadas no Supabase
- [ ] ✅ Função `hash_password` criada
- [ ] ✅ Variáveis de ambiente configuradas (local e Vercel)
- [ ] ✅ Primeiro usuário admin criado
- [ ] ✅ Teste de login admin funcionando
- [ ] ✅ Teste de permissões por role funcionando
- [ ] ✅ Teste de login cliente funcionando
- [ ] ✅ Horários de funcionamento configurados
- [ ] ✅ RLS (Row Level Security) ativado em todas as tabelas
- [ ] ✅ Service Role Key configurada **APENAS** no backend (Vercel)
- [ ] ✅ `.env` adicionado ao `.gitignore`

---

## 📞 Suporte

Se encontrar problemas não listados aqui:

1. Verifique os logs do Vercel: `vercel logs`
2. Verifique o console do navegador: `F12` → **Console**
3. Verifique os logs do Supabase: **Dashboard** → **Logs**

---

**🎉 Configuração Completa! Agora você pode usar o sistema de login com segurança.**

---

*Última atualização: Janeiro 2026*  
*Versão: 1.0*

