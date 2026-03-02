# 📱 Configurar n8n + WhatsApp para Avisos de Agendamento

## Visão Geral do Fluxo

```
Cliente faz agendamento
        ↓
  sistema salva no banco
        ↓
  envia POST para n8n webhook
        ↓
  n8n monta a mensagem
        ↓
  envia WhatsApp para o cliente
  envia WhatsApp para o Studio (aviso interno)
```

---

## PASSO 1 — Variáveis de Ambiente

No seu painel da **Vercel** (ou `.env.local` para testes), adicione:

```env
# URL do webhook criado no n8n (obrigatório)
N8N_WEBHOOK_URL=https://seu-n8n.com/webhook/studio-riquelme

# Chave de segurança opcional (recomendado em produção)
N8N_WEBHOOK_SECRET=uma-chave-secreta-qualquer
```

---

## PASSO 2 — Criar conta no n8n

Você tem duas opções:

### Opção A: n8n Cloud (mais fácil)
1. Acesse [app.n8n.io](https://app.n8n.io) e crie uma conta gratuita  
2. Você receberá uma URL tipo: `https://seu-nome.app.n8n.cloud`

### Opção B: n8n self-hosted (Railway ou VPS)
1. Acesse [railway.app](https://railway.app) → New Project → Deploy from template → pesquise "n8n"  
2. Siga as instruções de setup — normalmente em 5 minutos está no ar  
3. URL será algo como `https://n8n-xxx.up.railway.app`

---

## PASSO 3 — Escolher a API de WhatsApp

O n8n **não envia WhatsApp diretamente** — ele usa uma API de terceiros. Opções:

| API | Custo | Dificuldade | Recomendado para |
|-----|-------|-------------|-----------------|
| **Evolution API** | Gratuito (self-hosted) | Médio | Quem quer custo zero |
| **Z-API** | ~R$80/mês | Fácil | Uso profissional simples |
| **Twilio** | Pago por msg | Fácil | Empresas maiores |
| **WPP Connect** | Gratuito (self-hosted) | Difícil | Técnicos avançados |

**Recomendação: Z-API** para começar rápido, ou **Evolution API** para custo zero.

---

## PASSO 4 — Criar o Workflow no n8n

### 4.1 — Criar Webhook

1. No n8n, clique em **+ New Workflow**
2. Adicione o nó **Webhook**:
   - **HTTP Method:** `POST`
   - **Path:** `studio-riquelme`
   - Copie a URL gerada — ela será sua `N8N_WEBHOOK_URL`

### 4.2 — Estrutura do Workflow

```
[Webhook] → [Switch: tipo de evento] → [Set: formata mensagem] → [HTTP: envia WhatsApp]
```

O payload que o sistema enviará para o n8n é:

```json
{
  "event": "booking_created",
  "booking_id": "uuid-do-agendamento",
  "client_name": "João Silva",
  "client_phone": "5511987654321",
  "date": "2025-03-15",
  "time": "14:00:00",
  "services": [
    { "name": "Corte + Barba", "price": 65, "duration_minutes": 60 }
  ],
  "total_price": 65,
  "professional_name": "Studio Riquelme"
}
```

### 4.3 — Nó Switch (separar eventos)

Adicione um nó **Switch** after the webhook:
- **Campo:** `{{ $json.event }}`
- **Case 1:** `booking_created` → vai para mensagem de confirmação
- **Case 2:** `booking_cancelled` → vai para mensagem de cancelamento

### 4.4 — Nó Set (montar a mensagem)

Para o evento `booking_created`, adicione um nó **Set** com:

```
mensagem_cliente = ✅ *Agendamento Confirmado!*

Olá, {{ $json.client_name }}! 

📅 Data: {{ $json.date }}
⏰ Horário: {{ $json.time }}
✂️ Serviço: {{ $json.services[0].name }}
💰 Total: R$ {{ $json.total_price }}

📍 Studio Riquelme
Aguardamos você! 😊
```

Para cancelamento (`booking_cancelled`):
```
❌ *Agendamento Cancelado*

Olá, {{ $json.client_name }}.

Seu agendamento para {{ $json.date }} às {{ $json.time }} foi cancelado.

Para reagendar, acesse nosso sistema ou entre em contato.

📍 Studio Riquelme
```

### 4.5 — Nó HTTP Request (enviar via Z-API)

Se usar **Z-API**:
- **Method:** POST
- **URL:** `https://api.z-api.io/instances/SEU_INSTANCE_ID/token/SEU_TOKEN/send-text`
- **Body:**
```json
{
  "phone": "{{ $json.client_phone }}",
  "message": "{{ $json.mensagem_cliente }}"
}
```

Se usar **Evolution API**:
- **URL:** `http://sua-evolution-api/message/sendText/INSTANCIA`
- **Body:**
```json
{
  "number": "{{ $json.client_phone }}",
  "text": "{{ $json.mensagem_cliente }}"
}
```

---

## PASSO 5 — Aviso Interno para o Studio

Para que o Studio também receba um aviso a cada agendamento, adicione um segundo **HTTP Request** no mesmo fluxo com o número do WhatsApp do Studio:

```json
{
  "phone": "5511999999999",
  "message": "🔔 *Novo Agendamento!*\n\nCliente: {{ $json.client_name }}\nFone: {{ $json.client_phone }}\nData: {{ $json.date }}\nHora: {{ $json.time }}\nServiço: {{ $json.services[0].name }}"
}
```

---

## PASSO 6 — Lembrete 24h Antes (Agendado)

Para enviar lembretes automáticos, crie **um segundo workflow** no n8n:

1. Nó **Schedule Trigger** → todos os dias às 9h
2. Nó **HTTP Request** → consulta os agendamentos de amanhã:
   ```
   GET https://seu-site.vercel.app/api/bookings?from=AMANHÃ&to=AMANHÃ
   ```
3. Nó **Split In Batches** → processa cada agendamento
4. Nó **HTTP Request** → envia WhatsApp de lembrete

---

## PASSO 7 — Testar

Após configurar tudo, faça um teste:

1. Adicione a variável `N8N_WEBHOOK_URL` na Vercel
2. Acesse: `https://seu-site.vercel.app/api/whatsapp?test=1`
3. Isso enviará um payload de teste para o n8n
4. Verifique nos logs do n8n se chegou

---

## Segurança (Recomendado)

Para que apenas o seu sistema possa disparar o workflow no n8n:

1. No n8n, no nó Webhook, ative **"Header Auth"**
2. Configure: Header Name = `x-webhook-secret`, Value = `sua-chave-secreta`
3. Na Vercel, adicione: `N8N_WEBHOOK_SECRET=sua-chave-secreta`

---

## Resumo das Variáveis de Ambiente

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `N8N_WEBHOOK_URL` | ✅ Sim | URL do webhook criado no n8n |
| `N8N_WEBHOOK_SECRET` | ❌ Opcional | Chave de segurança para validar origem |

---

## Dicas

- **n8n gratuito** permite até 5.000 execuções/mês no plano free — suficiente para centenas de agendamentos mensais
- **Z-API** tem período de teste gratuito
- **Evolution API** é 100% gratuita, mas requer um servidor para hospedar
- O sistema **nunca falha** por causa do WhatsApp — se o n8n estiver offline, o agendamento é salvo normalmente, apenas o aviso não é enviado
