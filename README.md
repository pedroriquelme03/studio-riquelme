<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/18kkpPvjsFJ5sBQV6XbytGQwSXeEqtZbw

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Configuração de Notificações WhatsApp

O sistema envia mensagens automáticas via WhatsApp quando um atendimento é marcado como concluído. Para configurar, adicione as seguintes variáveis de ambiente:

### Para Evolution API (recomendado - open source):
```env
WHATSAPP_PROVIDER=evolution
WHATSAPP_API_URL=https://sua-instancia.evolutionapi.com
WHATSAPP_API_KEY=sua-api-key
WHATSAPP_INSTANCE_ID=seu-instance-id
```

### Para Z-API (serviço brasileiro):
```env
WHATSAPP_PROVIDER=zapi
WHATSAPP_API_URL=https://api.z-api.io
WHATSAPP_INSTANCE_ID=seu-instance-id
WHATSAPP_TOKEN=seu-token
```

### Para Twilio WhatsApp API:
```env
WHATSAPP_PROVIDER=twilio
WHATSAPP_API_KEY=seu-account-sid
WHATSAPP_TOKEN=seu-auth-token
WHATSAPP_PHONE_NUMBER_ID=seu-whatsapp-number-id
```

**Nota:** Certifique-se de que a tabela `bookings` no Supabase tenha uma coluna `completed_at` (tipo timestamp) para registrar quando o atendimento foi concluído.
