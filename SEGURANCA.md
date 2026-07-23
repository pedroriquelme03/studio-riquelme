# Correções de segurança — o que fazer para colocar no ar

Esta rodada fechou cinco falhas exploráveis sem autenticação. **As mudanças de
código não bastam**: sem os passos abaixo o sistema não sobe corretamente.

---

## 1. Variáveis de ambiente (obrigatório)

Adicione na Vercel (Settings → Environment Variables), em Production **e** Preview:

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `SESSION_SECRET` | **sim** | Assina os cookies de sessão. Sem ela, ninguém consegue logar. |
| `SUPABASE_SERVICE_ROLE_KEY` | **sim** | Acesso do servidor ao banco. Com a RLS fechada, a chave anônima deixa de funcionar. |
| `WHATSAPP_CLIENT_OTP_TEMPLATE` | sim, para "esqueci a senha" | Nome do template aprovado na Meta que envia o código de 6 dígitos. |

Gere o segredo (mínimo 32 caracteres):

```bash
openssl rand -hex 32
```

> **Atenção:** trocar `SESSION_SECRET` depois invalida todas as sessões ativas —
> todo mundo precisa entrar de novo. Não é destrutivo, mas evite trocar sem motivo.

### Template do OTP na Meta

Crie um template de WhatsApp com 3 parâmetros no corpo, por exemplo:

> Olá {{1}}, seu código de verificação é **{{2}}**. Ele expira em {{3}} minutos.
> Se você não pediu, ignore esta mensagem.

`{{1}}` nome · `{{2}}` código · `{{3}}` validade em minutos.
Depois de aprovado, ponha o nome dele em `WHATSAPP_CLIENT_OTP_TEMPLATE`.

Enquanto essa variável não existir, o "Esqueci a senha" do cliente responde
normalmente (mensagem genérica), mas nenhum código é enviado — e o log do
servidor registra o motivo.

---

## 2. Migração SQL — ✅ JÁ APLICADA

Aplicada em 23/07/2026 direto no projeto **Studio Riquelme**
(`gfxspozoasywxyffcirt`), em três migrações:

| Migração | O que fez |
|---|---|
| `add_client_password_resets_and_missing_columns` | Criou `client_password_resets`; adicionou `bookings.cancelled_at` (a API já gravava essa coluna, que não existia — o erro era engolido por um `console.warn`); criou índice `bookings(client_id)`. |
| `fix_special_date_hours_unique_index` | Trocou o índice **parcial** por um índice total com `NULLS NOT DISTINCT`. Era a causa do erro 42P10 e deixava os horários globais sem proteção contra duplicidade. |
| `lockdown_rls_all_public_tables` | Removeu as 22 policies `USING (true)`, ligou RLS nas 15 tabelas e revogou os `GRANT`s de `anon`/`authenticated`. |

Estado verificado depois: todas as 15 tabelas com `rls = true`, `policies = 0`,
`anon` sem SELECT nem INSERT. O arquivo [`security-hardening.sql`](security-hardening.sql)
fica como referência — **não precisa mais ser executado**.

Três tabelas (`booking_cancellations`, `business_hours`, `manual_slots`) estavam
com a RLS **inteiramente desligada**, não apenas com policy permissiva.

O linter do Supabase agora só acusa `rls_enabled_no_policy` (nível INFO), que é
exatamente o estado desejado: nega tudo por padrão, e a API acessa via
`service_role`, que tem `rolbypassrls = true`.

---

## 3. Rotacionar as senhas vazadas — ⚠️ PENDENTE, URGENTE

Conferido contra o banco de produção: **`anariquelme` e `biiariquelme` ainda
usam exatamente as senhas que estão em texto plano no `create-users.js`**,
versionado no Git. Ambas as contas estão ativas, com login recente.

| Usuário | Situação |
|---|---|
| `anariquelme` | 🔴 senha vazada em `create-users.js` |
| `biiariquelme` | 🔴 senha vazada em `create-users.js` |
| `biariquelme2` | SHA-256 sem salt (outra senha) |
| `livialopes` | SHA-256 sem salt (outra senha) |
| `pedroriquelme` | SHA-256 sem salt (outra senha) |

Apagar o arquivo **não resolve** — ele segue no histórico do repositório.
É preciso trocar as duas senhas de verdade, pelo painel (Usuários) ou pelo
"Esqueci minha senha". As demais migram para scrypt sozinhas no próximo login.

---

## O que mudou no comportamento

**Senhas.** Passaram a usar `scrypt` com salt. Os hashes SHA-256 antigos
continuam aceitos e são convertidos automaticamente no primeiro login válido —
ninguém fica de fora. O mínimo subiu de 6 para 8 caracteres em senhas novas.

**Sessão do admin.** Era `localStorage` (editável pelo usuário); agora é um
cookie `HttpOnly`, `SameSite=Strict`, assinado por HMAC, válido por 12 horas.
Todo mundo precisa entrar de novo uma vez.

**Sessão do cliente.** Cookie equivalente, válido por 30 dias. O `client_phone`
no `localStorage` continua existindo, mas só para exibir o número na tela — não
autoriza mais nada.

**"Esqueci a senha" do cliente.** Antes, saber o número bastava para trocar a
senha de qualquer pessoa. Agora exige um código de 6 dígitos enviado no
WhatsApp: expira em 10 minutos, aceita 5 tentativas e permite um envio por
minuto por número.

**Criar conta.** Se já existir conta com senha para aquele WhatsApp, o registro
é recusado (era o segundo caminho para tomada de conta).

**Login do cliente só com telefone.** A ação `login` da API foi **removida** —
ela deixava entrar em qualquer conta sabendo apenas o número. A tela já usava
`login_password`, então nada na interface muda.

**Reset de senha do admin.** A resposta da API não devolve mais o link de
redefinição quando o e-mail falha (`debug_link`). Os tokens agora são guardados
como hash, e redefinir a senha queima todos os tokens pendentes daquele admin.

**Rotas de debug.** `/profiles` e `/supabase-test` foram removidas.

### Quem pode o quê, agora

| Rota | Público | Cliente | Admin |
|---|---|---|---|
| `GET /api/services` | ✅ | ✅ | ✅ |
| `GET /api/schedule-settings` | ✅ | ✅ | ✅ |
| `GET /api/bookings?availability=1&from=&to=` | ✅ (sem dados pessoais) | ✅ | ✅ |
| `GET /api/bookings` | ❌ | próprios | todos |
| `PUT /api/bookings` (cancelar) | ❌ | só os próprios | ✅ |
| `PATCH /api/bookings` (reagendar) | ❌ | ❌ | ✅ |
| `POST /api/reschedule-requests` | ❌ | só os próprios | — |
| `PUT /api/reschedule-requests` (aprovar) | ❌ | ❌ | ✅ |
| `GET /api/cancellations` | ❌ | próprios | todos |
| `/api/professionals`, `/api/clients`, `/api/notifications` | ❌ | ❌ | ✅ |
| escrita em `services` / `schedule-settings` | ❌ | ❌ | ✅ |

`POST /api/bookings` (criar agendamento) segue público — é o fluxo de
agendamento do site.

---

## Como conferir que funcionou

Com o site no ar, sem estar logado:

```bash
curl -s https://SEU-DOMINIO/api/bookings | head -c 200
```

Deve responder `{"ok":false,"error":"Não autorizado"}`. Antes, devolvia a base
inteira de clientes com nome, telefone e e-mail.

```bash
curl -s -X PUT https://SEU-DOMINIO/api/auth \
  -H 'Content-Type: application/json' \
  -d '{"username":"invasor","password":"12345678","name":"teste"}'
```

Deve responder `{"ok":false,"error":"Não autorizado"}`. Antes, criava um
administrador.

---

## O que continua em aberto

Os itens abaixo foram levantados na auditoria e **não** entraram nesta rodada:

- **Overbooking:** `POST /api/bookings` ainda não revalida colisão de horário no
  servidor nem tem índice único no banco — dois clientes simultâneos ainda
  conseguem o mesmo horário.
- **Fuso horário:** `App.tsx` grava a data via `toISOString()`, que pode salvar
  o dia seguinte em agendamentos feitos à noite.
- **Registro de conta:** um número que ainda não tem senha pode ser reivindicado
  sem OTP. Fecha a tomada de contas ativas, mas não o acesso ao histórico de um
  cliente antigo que nunca criou login. Exigir OTP também no registro resolveria.
- **`ensureSchemaIfMissing()`** roda DDL e abre uma conexão Postgres a cada
  request em `/api/cancellations`.
