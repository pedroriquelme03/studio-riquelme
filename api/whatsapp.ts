/**
 * api/whatsapp.ts
 *
 * Utilitário para disparar webhooks do n8n que enviam mensagens WhatsApp.
 * Suporta os eventos: booking_created, booking_cancelled, reschedule_approved
 *
 * Para usar, configure a variável de ambiente:
 *   N8N_WEBHOOK_URL=https://seu-n8n.com/webhook/studio-riquelme
 *
 * O n8n receberá um POST com o payload do evento e enviará a mensagem
 * via Evolution API, Z-API, Twilio ou qualquer integração configurada.
 */

export type WhatsAppEventType =
  | 'booking_created'
  | 'booking_cancelled'
  | 'reschedule_requested'
  | 'reschedule_approved';

export interface WhatsAppPayload {
  event: WhatsAppEventType;
  booking_id: string;
  client_name: string;
  client_phone: string;
  date: string;        // yyyy-mm-dd
  time: string;        // HH:MM:SS
  services: Array<{ name: string; price: number; duration_minutes: number }>;
  total_price: number;
  professional_name?: string;
  notes?: string;
  // Campos extras para reagendamento
  new_date?: string;
  new_time?: string;
}

/**
 * Dispara o webhook do n8n de forma assíncrona (não bloqueia a resposta da API).
 * Em caso de erro, apenas loga no console sem lançar exceção.
 */
export async function triggerN8nWebhook(payload: WhatsAppPayload): Promise<void> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('[n8n] N8N_WEBHOOK_URL não configurada — webhook ignorado.');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Chave de segurança opcional para validar origem no n8n
        ...(process.env.N8N_WEBHOOK_SECRET
          ? { 'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[n8n] Webhook falhou (${response.status}):`, text);
    } else {
      console.log(`[n8n] Webhook disparado com sucesso. Evento: ${payload.event}, Cliente: ${payload.client_name}`);
    }
  } catch (err: any) {
    // Nunca deixar o erro do n8n derrubar a API principal
    console.error('[n8n] Erro ao disparar webhook:', err?.message || err);
  }
}

/**
 * Handler HTTP para testes manuais do webhook via GET/POST.
 * Acesse /api/whatsapp?test=1 para testar se a URL do n8n está respondendo.
 */
export default async function handler(req: any, res: any) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (req.method === 'GET') {
    const url = new URL(req?.url || '/', 'http://localhost');
    const isTest = url.searchParams.get('test') === '1';

    if (isTest && webhookUrl) {
      // Envia payload de teste ao n8n
      const testPayload: WhatsAppPayload = {
        event: 'booking_created',
        booking_id: 'test-' + Date.now(),
        client_name: 'Cliente Teste',
        client_phone: '5511999999999',
        date: new Date().toISOString().split('T')[0],
        time: '14:00:00',
        services: [{ name: 'Corte + Barba', price: 65, duration_minutes: 60 }],
        total_price: 65,
        professional_name: 'Studio Riquelme',
        notes: 'Mensagem de teste do sistema',
      };

      await triggerN8nWebhook(testPayload);
      return res.status(200).json({
        ok: true,
        message: 'Payload de teste enviado ao n8n',
        webhook_url: webhookUrl,
        payload: testPayload,
      });
    }

    return res.status(200).json({
      ok: true,
      configured: !!webhookUrl,
      webhook_url: webhookUrl ? '✅ Configurada' : '❌ N8N_WEBHOOK_URL não definida',
      instructions: 'Adicione ?test=1 para enviar um payload de teste ao n8n',
    });
  }

  res.setHeader('Allow', 'GET');
  return res.status(405).json({ ok: false, error: 'Método não permitido' });
}
