/**
 * Webhook n8n — disparo de eventos de agendamento (booking_created, booking_cancelled).
 * Usado por api/bookings.ts. Teste: GET /api/bookings?webhook_test=1
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
  date: string;
  time: string;
  services: Array<{ name: string; price: number; duration_minutes: number }>;
  total_price: number;
  professional_name?: string;
  notes?: string;
  new_date?: string;
  new_time?: string;
}

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
        ...(process.env.N8N_WEBHOOK_SECRET ? { 'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[n8n] Webhook falhou (${response.status}):`, text);
    } else {
      console.log(`[n8n] Webhook disparado. Evento: ${payload.event}, Cliente: ${payload.client_name}`);
    }
  } catch (err: any) {
    console.error('[n8n] Erro ao disparar webhook:', err?.message || err);
  }
}
