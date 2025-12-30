# Configuração de Envio de Email

Este guia explica como configurar o envio de emails para a funcionalidade de "Esqueci a Senha".

## Opções Disponíveis

O sistema suporta três provedores de email:

1. **Resend** (Recomendado - Mais simples)
2. **Mailgun** (Alternativa popular)
3. **SendGrid** (Alternativa popular)

## 1. Configuração com Resend (Recomendado)

### Passo 1: Criar conta no Resend
1. Acesse https://resend.com
2. Crie uma conta gratuita
3. Vá em "API Keys" e crie uma nova chave
4. Copie a chave API

### Passo 2: Configurar variáveis de ambiente

No Vercel (ou seu ambiente de produção):
1. Vá em Settings → Environment Variables
2. Adicione as seguintes variáveis:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@seudominio.com.br
FRONTEND_URL=https://seu-site.vercel.app
```

**Nota:** O `EMAIL_FROM` deve ser um domínio verificado no Resend.

### Passo 3: Verificar domínio no Resend
1. No dashboard do Resend, vá em "Domains"
2. Adicione seu domínio
3. Configure os registros DNS conforme instruções
4. Aguarde a verificação

## 2. Configuração com Mailgun

### Passo 1: Criar conta no Mailgun
1. Acesse https://www.mailgun.com
2. Crie uma conta (plano gratuito disponível)
3. Vá em "Sending" → "Domain Settings"
4. Copie sua API Key e Domain

### Passo 2: Configurar variáveis de ambiente

```env
EMAIL_PROVIDER=smtp
SMTP_SERVICE=mailgun
MAILGUN_API_KEY=xxxxxxxxxxxxx
MAILGUN_DOMAIN=mg.seudominio.com.br
EMAIL_FROM=noreply@seudominio.com.br
FRONTEND_URL=https://seu-site.vercel.app
```

## 3. Configuração com SendGrid

### Passo 1: Criar conta no SendGrid
1. Acesse https://sendgrid.com
2. Crie uma conta gratuita
3. Vá em "Settings" → "API Keys"
4. Crie uma nova API Key com permissão "Mail Send"
5. Copie a chave

### Passo 2: Configurar variáveis de ambiente

```env
EMAIL_PROVIDER=smtp
SMTP_SERVICE=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
EMAIL_FROM=noreply@seudominio.com.br
FRONTEND_URL=https://seu-site.vercel.app
```

## 4. Configuração Local (Desenvolvimento)

Para desenvolvimento local, você pode:

### Opção A: Usar Resend (recomendado)
1. Crie uma conta no Resend
2. Adicione as variáveis no arquivo `.env.local`:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=sua-chave-aqui
EMAIL_FROM=onboarding@resend.dev
FRONTEND_URL=http://localhost:3000
```

**Nota:** O Resend permite usar `onboarding@resend.dev` para testes sem verificar domínio.

### Opção B: Ver link no console
Se não configurar email, o link aparecerá no console do servidor durante desenvolvimento.

## 5. Variáveis de Ambiente no Vercel

Para adicionar no Vercel:

1. Acesse seu projeto no Vercel
2. Vá em **Settings** → **Environment Variables**
3. Adicione cada variável:
   - `EMAIL_PROVIDER` = `resend` (ou `smtp`)
   - `RESEND_API_KEY` = sua chave (se usar Resend)
   - `EMAIL_FROM` = seu email de envio
   - `FRONTEND_URL` = URL do seu site (ex: `https://seu-site.vercel.app`)

4. Se usar Mailgun:
   - `SMTP_SERVICE` = `mailgun`
   - `MAILGUN_API_KEY` = sua chave
   - `MAILGUN_DOMAIN` = seu domínio

5. Se usar SendGrid:
   - `SMTP_SERVICE` = `sendgrid`
   - `SENDGRID_API_KEY` = sua chave

6. Clique em **Save** e faça um novo deploy

## 6. Testar o Envio

1. Acesse a página de login
2. Clique em "Esqueci minha senha"
3. Digite o email de um admin cadastrado
4. Verifique se o email chegou (pode levar alguns segundos)
5. Clique no link no email para redefinir a senha

## Troubleshooting

### Email não está chegando

1. **Verifique as variáveis de ambiente:**
   - Certifique-se de que todas estão configuradas corretamente
   - No Vercel, verifique se estão aplicadas ao ambiente correto (Production/Preview)

2. **Verifique os logs:**
   - No console do Vercel, veja se há erros ao enviar email
   - Em desenvolvimento, o erro aparecerá no console

3. **Verifique spam:**
   - O email pode ter ido para a pasta de spam
   - Verifique se o domínio está verificado no provedor

4. **Teste com Resend:**
   - O Resend é mais simples e tem melhor documentação
   - Use `onboarding@resend.dev` para testes sem verificar domínio

### Erro "EMAIL_PROVIDER não configurado"

Certifique-se de que a variável `EMAIL_PROVIDER` está definida como `resend` ou `smtp`.

### Erro de autenticação

- Verifique se a API key está correta
- No Resend, certifique-se de que a chave tem permissão para enviar emails
- No SendGrid, certifique-se de que a chave tem permissão "Mail Send"

## Custos

- **Resend:** 3.000 emails/mês grátis, depois $20/mês
- **Mailgun:** 5.000 emails/mês grátis (primeiros 3 meses), depois pago
- **SendGrid:** 100 emails/dia grátis, depois pago

Para a maioria dos casos, o plano gratuito é suficiente.

