/**
 * Webhook WhatsApp (Meta Cloud API) — recebe mensagens e status.
 * Deploy: supabase functions deploy whatsapp-webhook
 *
 * URL no painel Meta: https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook
 *
 * Secrets (Supabase): supabase secrets set WHATSAPP_WEBHOOK_VERIFY_TOKEN=...
 * Opcional: supabase secrets set WHATSAPP_APP_SECRET=...
 *
 * verify_jwt=false no config.toml → a Meta pode chamar GET/POST sem Authorization.
 */
import "@supabase/functions-js/edge-runtime.d.ts";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function hmacSha256Hex(secret: string, data: ArrayBuffer): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const la = a.length;
  if (la !== b.length || la === 0) return false;
  let out = 0;
  for (let i = 0; i < la; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function verifyMetaSignature(
  rawBody: ArrayBuffer,
  signatureHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const recv = signatureHeader.slice("sha256=".length).toLowerCase().trim();
  const exp = (await hmacSha256Hex(appSecret, rawBody)).toLowerCase();
  return timingSafeEqualHex(recv, exp);
}

function summarizeWebhook(body: Record<string, unknown>): unknown {
  const object = body?.object;
  if (object !== "whatsapp_business_account") {
    return { object };
  }
  const summaries: unknown[] = [];
  const entries = (body as { entry?: unknown[] }).entry ?? [];
  for (const entry of entries) {
    const e = entry as { id?: string; changes?: unknown[] };
    for (const ch of e.changes ?? []) {
      const change = ch as { field?: string; value?: Record<string, unknown> };
      const field = change.field;
      const value = change.value ?? {};
      const row: Record<string, unknown> = { waba_entry_id: e.id, field };
      if (field === "messages") {
        const messages = value.messages as unknown[] | undefined;
        const statuses = value.statuses as unknown[] | undefined;
        if (messages?.length) row.incoming_messages = messages.length;
        if (statuses?.length) row.status_updates = statuses.length;
      }
      summaries.push(row);
    }
  }
  return summaries;
}

Deno.serve(async (req) => {
  const verifyToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN")?.trim();
  const appSecret = Deno.env.get("WHATSAPP_APP_SECRET")?.trim();

  try {
    if (req.method === "GET") {
      if (!verifyToken) {
        return jsonResponse(500, {
          ok: false,
          error: "WHATSAPP_WEBHOOK_VERIFY_TOKEN não configurado (secrets Supabase)",
        });
      }
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token === verifyToken && challenge) {
        return new Response(challenge, {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      return jsonResponse(403, { ok: false, error: "Falha na verificação do webhook" });
    }

    if (req.method === "POST") {
      const rawBuffer = await req.arrayBuffer();
      const rawBytes = new Uint8Array(rawBuffer);

      if (appSecret) {
        const sig = req.headers.get("x-hub-signature-256");
        const ok = await verifyMetaSignature(rawBuffer, sig, appSecret);
        if (!ok) {
          return jsonResponse(403, { ok: false, error: "Assinatura X-Hub-Signature-256 inválida" });
        }
      }

      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(new TextDecoder().decode(rawBytes)) as Record<string, unknown>;
      } catch {
        return jsonResponse(400, { ok: false, error: "JSON inválido" });
      }

      try {
        console.log("[whatsapp-webhook]", JSON.stringify(summarizeWebhook(payload)));
      } catch {
        /* noop */
      }

      return jsonResponse(200, { ok: true });
    }

    return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse(500, { ok: false, error: msg });
  }
});
