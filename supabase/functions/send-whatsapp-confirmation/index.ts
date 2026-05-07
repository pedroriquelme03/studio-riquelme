import "@supabase/functions-js/edge-runtime.d.ts"

/** Secrets: WHATSAPP_TOKEN, PHONE_NUMBER_ID. Opcional: WHATSAPP_TEMPLATE_LANGUAGE (ex. pt_BR). hello_world usa en_US por padrão. */

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
  template_params?: string[];
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
    const templateParams = Array.isArray(body?.template_params)
      ? body.template_params.map((v) => String(v ?? ""))
      : [];

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
    // Idioma deve bater com o template na Meta (hello_world padrão costuma ser en_US).
    const lang =
      Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE")?.trim() ||
      (templateName === "hello_world" ? "en_US" : "pt_BR");

    const templatePayload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: normalizedPhone,
      type: "template",
      template: {
        name: templateName,
        language: { code: lang },
      },
    };

    // Se vierem parâmetros, envia como body params do template.
    if (templateParams.length > 0) {
      templatePayload.template = {
        name: templateName,
        language: { code: lang },
        components: [
          {
            type: "body",
            parameters: templateParams.map((text) => ({ type: "text", text })),
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
