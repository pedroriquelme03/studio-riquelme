# Debug do Envio de Email

## Problemas Comuns e Soluções

### 1. Verificar Variáveis de Ambiente no Vercel

Certifique-se de que as variáveis estão configuradas corretamente:

- `EMAIL_PROVIDER` = `resend` (exatamente assim, minúsculo)
- `RESEND_API_KEY` = sua chave completa (começa com `re_`)
- `EMAIL_FROM` = deve ser um email do domínio verificado no Resend
- `FRONTEND_URL` = deve incluir `https://` (ex: `https://studioriquelme.com.br`)

### 2. Verificar Logs no Vercel

1. Acesse seu projeto no Vercel
2. Vá em **Deployments** → clique no último deploy
3. Vá em **Functions** → encontre a função `/api/auth`
4. Clique em **View Function Logs**
5. Tente fazer um reset de senha novamente
6. Veja os logs que começam com `[AUTH]` e `[SENDEMAIL]`

### 3. Problemas Específicos

#### Erro: "RESEND_API_KEY não configurada"
- Verifique se a variável está no Vercel
- Certifique-se de que fez um novo deploy após adicionar
- Verifique se não há espaços extras no valor

#### Erro: "Resend API: 403" ou "Unauthorized"
- Verifique se a API key está correta
- Certifique-se de que a chave não expirou
- No Resend, verifique se a chave tem permissão para enviar emails

#### Erro: "Resend API: Domain not verified"
- O `EMAIL_FROM` deve usar um domínio verificado no Resend
- Vá no Resend → Domains → verifique se o domínio está "Verified"
- Se não estiver, configure os registros DNS conforme instruções

#### Email não chega mas não há erro
- Verifique a pasta de spam
- Verifique se o email do admin está correto no banco
- Veja os logs para confirmar que o email foi enviado com sucesso

### 4. Teste Rápido

Para testar se está funcionando:

1. Acesse a página de login
2. Clique em "Esqueci minha senha"
3. Digite o email do admin (ex: `admin@studioriquelme.com.br`)
4. Verifique os logs no Vercel
5. Se houver erro, ele aparecerá nos logs com `[AUTH]` ou `[SENDEMAIL]`

### 5. Verificar Configuração do Resend

1. Acesse https://resend.com
2. Vá em **API Keys** → verifique se a chave está ativa
3. Vá em **Domains** → verifique se `studioriquelme.com.br` está "Verified"
4. Se não estiver verificado:
   - Clique no domínio
   - Configure os registros DNS conforme mostrado
   - Aguarde alguns minutos para propagação

### 6. Correção do FRONTEND_URL

**IMPORTANTE:** O `FRONTEND_URL` no Vercel deve incluir `https://`:

✅ **Correto:**
```
FRONTEND_URL=https://studioriquelme.com.br
```

❌ **Incorreto:**
```
FRONTEND_URL=studioriquelme.com.br
```

O código agora corrige automaticamente, mas é melhor configurar corretamente.

### 7. Verificar Email do Admin no Banco

Certifique-se de que o admin tem um email válido cadastrado:

```sql
SELECT id, username, email FROM public.admins WHERE username = 'admin';
```

Se o email estiver vazio ou incorreto, atualize:

```sql
UPDATE public.admins 
SET email = 'admin@studioriquelme.com.br' 
WHERE username = 'admin';
```

## Próximos Passos

1. Verifique os logs no Vercel após tentar resetar a senha
2. Copie os logs que começam com `[AUTH]` ou `[SENDEMAIL]`
3. Compartilhe os logs para identificar o problema específico

