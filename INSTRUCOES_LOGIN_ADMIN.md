# Instruções para Configurar Sistema de Login Admin

## 1. Criar a Tabela no Supabase

Execute o script SQL `admin-schema.sql` no Supabase:

1. Acesse o Supabase Dashboard
2. Vá em "SQL Editor"
3. Cole o conteúdo do arquivo `admin-schema.sql`
4. Execute o script

## 2. Criar o Primeiro Admin

### Opção 1: Usando o Script Node.js

Execute no terminal:
```bash
node create-admin.js
```

Isso irá gerar um comando SQL que você pode executar no Supabase.

### Opção 2: Criar Manualmente

Execute este SQL no Supabase (substitua os valores se necessário):

```sql
INSERT INTO public.admins (username, password_hash, name, email, is_active)
VALUES (
  'admin',
  'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', -- hash de 'studio2024'
  'Administrador',
  'admin@studioriquelme.com.br',
  true
)
ON CONFLICT (username) DO NOTHING;
```

**Nota:** A senha padrão é `studio2024` e o usuário é `admin`.

### Opção 3: Usando a API

Você também pode criar um admin via API (endpoint PUT `/api/auth`):

```javascript
fetch('/api/auth', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'studio2024',
    name: 'Administrador',
    email: 'admin@studioriquelme.com.br'
  })
});
```

## 3. Credenciais Padrão

- **Usuário:** `admin`
- **Senha:** `studio2024`

**IMPORTANTE:** Altere a senha padrão após o primeiro acesso!

## 4. Como Funciona

- As senhas são armazenadas com hash SHA-256
- A autenticação é feita através da API `/api/auth`
- A sessão é mantida no localStorage do navegador
- O último login é registrado automaticamente

## 5. Criar Novos Admins

Para criar novos admins, você pode:

1. Usar a API PUT `/api/auth` (requer autenticação ou acesso direto)
2. Inserir manualmente no banco (lembre-se de gerar o hash da senha)
3. Criar um script similar ao `create-admin.js`

## Segurança

- As senhas são armazenadas como hash (não em texto plano)
- Use a chave `SUPABASE_SERVICE_ROLE_KEY` na API (não a anon key)
- Em produção, considere usar bcrypt ao invés de SHA-256
- Implemente rate limiting para prevenir ataques de força bruta

