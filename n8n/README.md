# Agente de WhatsApp (n8n + Evolution API)

```
Cliente → WhatsApp → Evolution API ──webhook──▶ n8n (agente Google Gemini)
                          ▲                        │
                          └──── sendText ──────────┤
                                                   └─▶ /api/whatsapp-webhook?agent=… (Vercel)
```

O agente consulta serviços e horários livres, registra agendamentos e lista ou
cancela os agendamentos do cliente. As regras de agenda ficam no backend
([api/_lib/agent-tools.ts](../api/_lib/agent-tools.ts)); o n8n só conversa.

## 1. Backend (Vercel)

1. Crie a variável `AGENT_API_KEY` (Production) com uma chave longa:

   ```bash
   openssl rand -hex 32
   ```

2. Confirme que `SESSION_SECRET`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem
   (o cancelamento usa `SESSION_SECRET`).
3. Execute [sql/agent-memory-schema.sql](../sql/agent-memory-schema.sql) no SQL Editor do
   Supabase (tabela da memória do agente). Sem ela o agente funciona, mas não lembra de nada.
4. Faça o deploy e teste — deve devolver o catálogo:

   ```bash
   curl -X POST "https://studioriquelme.com.br/api/whatsapp-webhook?agent=catalog" -H "x-agent-key: SUA_CHAVE" -H "Content-Type: application/json" -d "{}"
   ```

## 2. n8n

O n8n roda na VPS (`/root/n8n/docker-compose.yml`, container `n8n`), na mesma rede
Docker do Evolution do Studio (`evolution_default`). O painel só escuta em
`127.0.0.1:5678`, então não fica exposto na internet. Para abrir, crie um túnel SSH
e acesse <http://localhost:5678>:

```bash
ssh -N -L 5678:localhost:5678 studio-vps
```

Dentro da rede Docker, o n8n chama o Evolution em `http://evolution_api:8080` e o
Evolution entrega o webhook em `http://n8n:5678/webhook/<caminho>`.

1. O workflow já foi importado na VPS. Para reimportar após mudanças:
   **Workflows → Import from File** → `whatsapp-agent.workflow.json`.
2. Crie três credenciais e selecione-as nos nós (a do Redis já foi criada na VPS):

   | Credencial | Tipo | Valor | Nós |
   |---|---|---|---|
   | Google Gemini | Google Gemini(PaLM) Api | API key do Google AI Studio | Google Gemini |
   | Agent API | Header Auth | Name `x-agent-key`, Value = `AGENT_API_KEY` | Contexto e as 7 ferramentas |
   | Evolution | Header Auth | Name `apikey`, Value = apikey da Evolution | Enviar resposta |

3. O nó **Config** já vem com `evolutionUrl` = `http://evolution_api:8080` e
   `instance` = `StudioRiquelme`.
4. Ative (publique) o workflow.

## 3. Evolution API

Aponte o webhook da instância `StudioRiquelme` para o n8n pela rede interna, com o
evento `MESSAGES_UPSERT` (pelo Manager, em Events → Webhook, ou pela API, de dentro da VPS):

```bash
curl -X POST "http://localhost:8080/webhook/set/StudioRiquelme" -H "apikey: SUA_APIKEY" -H "Content-Type: application/json" -d "{\"webhook\":{\"enabled\":true,\"url\":\"http://n8n:5678/webhook/CAMINHO_DO_NO_WEBHOOK\",\"byEvents\":false,\"base64\":false,\"events\":[\"MESSAGES_UPSERT\"]}}"
```

O caminho está no nó Webhook do workflow (`studio-riquelme-wa-...`).

O caminho do webhook tem um trecho aleatório que funciona como segredo: não o divulgue.

## Atendimento humano

- Quando alguém do salão responde manualmente pelo mesmo número, o agente fica
  calado naquela conversa por 12 horas (`pauseHours` no nó Config).
- Para devolver a conversa ao agente antes disso, envie `#agente` nela.
- Mensagens automáticas (do agente e as notificações do site) levam um caractere
  invisível no início, para não serem confundidas com uma resposta humana.
- A pausa fica no n8n e se perde se o n8n reiniciar.

## Memória

O agente tem dois níveis de memória:

- **Da conversa** (nó "Memória da conversa", Redis Chat Memory): as últimas 20
  mensagens de cada telefone. Ficam no Redis da stack do Evolution (`evolution_redis`,
  db 2, chaves `studio-riquelme:wa:<telefone>`; o Evolution usa o db 1), sobrevivem a
  reinícios do n8n e expiram após 24 horas sem mensagens (`sessionTTL`).
- **Do cliente** (ferramentas `lembrar` e `esquecer`): fatos duradouros — profissional
  preferida, serviço de costume, tamanho do cabelo, horários que prefere, alergias a
  produtos. Ficam na tabela `agent_client_memories` do Supabase, por telefone, e são
  entregues ao agente no início de cada mensagem. Máximo de 20 por cliente, 300
  caracteres cada; ao passar disso, as mais antigas são apagadas.

Para ver ou corrigir o que o agente guardou, use a tabela `agent_client_memories`
no Supabase. O cliente também pode pedir ao agente para apagar algo.

## Limites

- Só texto: para áudio, imagem ou documento o agente pede que o cliente escreva.
- Promoções e planos mensais continuam sendo contratados pelo site.
- Remarcar = registrar o novo horário e cancelar o antigo.
