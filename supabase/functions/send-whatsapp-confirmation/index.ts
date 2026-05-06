import "@supabase/functions-js/edge-runtime.d.ts"

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};

type Payload = {
  nome?: string;
  telefone?: string;
  data?: string;
  hora?: string;
  template_name?: string;
};

const jsonHeaders = { "Content-Type": "application/json" };

function normalizePhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(405, {
      ok: false,
      error: "Método não permitido. Use POST.",
    });
  }

  try {
    const body = (await req.json()) as Payload;
    const nome = body?.nome?.trim();
    const telefone = body?.telefone?.trim();
    const data = body?.data?.trim();
    const hora = body?.hora?.trim();
    const templateName = (body?.template_name?.trim() || "hello_world");

    if (!nome || !telefone || !data || !hora) {
      return jsonResponse(400, {
        ok: false,
        error: "Campos obrigatórios: nome, telefone, data, hora.",
      });
    }

    const phoneNumberId = Deno.env.get("PHONE_NUMBER_ID");
    const whatsappToken = Deno.env.get("WHATSAPP_TOKEN");

    if (!phoneNumberId || !whatsappToken) {
      return jsonResponse(500, {
        ok: false,
        error: "Secrets ausentes: PHONE_NUMBER_ID e/ou WHATSAPP_TOKEN.",
      });
    }

    const normalizedPhone = normalizePhone(telefone);
    if (!normalizedPhone) {
      return jsonResponse(400, {
        ok: false,
        error: "Telefone inválido.",
      });
    }

    const endpoint = `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`;
    const templatePayload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: normalizedPhone,
      type: "template",
      template: {
        name: templateName,
        language: { code: "pt_BR" },
      },
    };

    // Deixa pronto o template real com placeholders dinâmicos.
    if (templateName === "agendamento_confirmado") {
      templatePayload.template = {
        name: "agendamento_confirmado",
        language: { code: "pt_BR" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: nome },
              { type: "text", text: data },
              { type: "text", text: hora },
            ],
          },
        ],
      };
    }

    const waResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${whatsappToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(templatePayload),
    });

    const waText = await waResponse.text();
    let waJson: unknown = waText;
    try {
      waJson = JSON.parse(waText);
    } catch {
      // mantém texto bruto se não for JSON
    }

    if (!waResponse.ok) {
      return jsonResponse(waResponse.status, {
        ok: false,
        error: "Falha ao enviar mensagem na WhatsApp Cloud API.",
        details: waJson,
      });
    }

    return jsonResponse(200, {
      ok: true,
      message: "Mensagem enviada com sucesso.",
      template: templateName,
      telefone_formatado: normalizedPhone,
      whatsapp_response: waJson,
    });
  } catch (error) {
    return jsonResponse(500, {
      ok: false,
      error: "Erro inesperado ao processar requisição.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
