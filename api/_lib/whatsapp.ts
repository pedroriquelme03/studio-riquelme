// Envio de WhatsApp via Evolution API (self-hosted na VPS).
// Mantido em _lib/ para não contar como Serverless Function no Vercel Hobby.
//
// Gated por variáveis de ambiente — se EVOLUTION_* não estiver configurado,
// o envio é ignorado silenciosamente e NUNCA quebra o fluxo de agendamento.
//
// Variáveis necessárias (definir na Vercel):
//   EVOLUTION_API_URL   ex.: https://whats.studioriquelme.com.br  (ou http://IP:8080)
//   EVOLUTION_API_KEY   a apikey global da Evolution
//   EVOLUTION_INSTANCE  nome da instância conectada (ex.: StudioRiquelme)

function getConfig() {
	return {
		baseUrl: (process.env.EVOLUTION_API_URL || '').replace(/\/+$/, ''),
		apiKey: (process.env.EVOLUTION_API_KEY || '').trim(),
		instance: (process.env.EVOLUTION_INSTANCE || '').trim(),
	};
}

/**
 * Normaliza um telefone brasileiro para o formato exigido pela Evolution:
 * 55 + DDD + número (somente dígitos). Retorna null se não der para normalizar.
 */
export function normalizePhoneBR(input: string): string | null {
	let d = String(input || '').replace(/\D/g, '');
	if (!d) return null;
	d = d.replace(/^0+/, ''); // remove zeros à esquerda (ex.: 045...)

	// Já vem com o código do país (55) + DDD + número
	if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d;
	// Número local: DDD (2) + número (8 fixo ou 9 celular)
	if (d.length === 10 || d.length === 11) return '55' + d;
	// Tamanho de número internacional sem 55 explícito — melhor esforço
	if (d.length === 12 || d.length === 13) return d;
	return null;
}

/**
 * Envia uma mensagem de texto simples via Evolution API.
 * Retorna { ok } e nunca lança — erros são logados, não propagados.
 */
export async function sendWhatsAppText(
	phone: string,
	text: string,
): Promise<{ ok: boolean; error?: string }> {
	const { baseUrl, apiKey, instance } = getConfig();
	if (!baseUrl || !apiKey || !instance) {
		console.log('[whatsapp] EVOLUTION_API_URL/EVOLUTION_API_KEY/EVOLUTION_INSTANCE ausentes — envio ignorado.');
		return { ok: false, error: 'not_configured' };
	}

	const number = normalizePhoneBR(phone);
	if (!number) {
		console.warn('[whatsapp] Telefone inválido, envio ignorado:', phone);
		return { ok: false, error: 'invalid_phone' };
	}

	try {
		const response = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instance)}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				apikey: apiKey,
			},
			body: JSON.stringify({ number, text }),
		});

		if (!response.ok) {
			const body = await response.text().catch(() => '');
			console.error(`[whatsapp] Evolution falhou (${response.status}):`, body);
			return { ok: false, error: `evolution_${response.status}` };
		}
		console.log(`[whatsapp] Mensagem enviada para ${number}`);
		return { ok: true };
	} catch (err: any) {
		console.error('[whatsapp] Erro ao enviar via Evolution:', err?.message || err);
		return { ok: false, error: err?.message || 'send_failed' };
	}
}

// ── Formatadores ─────────────────────────────────────────────────────
export function formatDateToPtBr(input: string): string {
	const [year, month, day] = String(input).split('-');
	if (!year || !month || !day) return input;
	return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
}

export function formatTimeToHHMM(input: string): string {
	const str = String(input || '');
	return str.length >= 5 ? str.slice(0, 5) : str;
}

// ── Modelos de mensagem (Studio Riquelme) ────────────────────────────
interface MsgData {
	nome?: string;
	cliente?: string;
	servico?: string;
	data?: string;
	hora?: string;
}

export const waMessages = {
	// Código de acesso (login/reset de senha) → cliente
	loginCode: (o: { nome?: string; codigo?: string; minutos?: number }) =>
		`🔐 *Studio Riquelme*\n\nOlá, ${o.nome}! Seu código de acesso é:\n\n*${o.codigo}*\n\nVálido por ${o.minutos} minutos. Não compartilhe com ninguém.`,

	// Nova solicitação → cliente
	bookingRequestClient: (o: MsgData) =>
		`Olá, ${o.nome}! 👋\n\nRecebemos sua solicitação de agendamento no *Studio Riquelme*:\n\n✂️ ${o.servico}\n📅 ${o.data} às ${o.hora}\n\nEm breve confirmaremos seu horário. Qualquer dúvida, é só responder por aqui. 😉`,

	// Nova solicitação → profissional
	bookingRequestProfessional: (o: MsgData) =>
		`📩 *Nova solicitação de agendamento!*\n\n👤 Cliente: ${o.cliente}\n✂️ Serviço: ${o.servico}\n📅 ${o.data} às ${o.hora}\n\nAcesse o painel para confirmar.`,

	// Confirmação → cliente
	bookingConfirmed: (o: MsgData) =>
		`✅ *Agendamento confirmado*, ${o.nome}!\n\n✂️ ${o.servico}\n📅 ${o.data} às ${o.hora}\n📍 Studio Riquelme\n\nTe esperamos! Para cancelar ou remarcar, é só entrar em contato.`,

	// Cancelamento (feito pelo salão) → cliente
	bookingCancelledClient: (o: MsgData) =>
		`❌ Olá, ${o.nome}.\n\nSeu agendamento foi *cancelado*:\n\n✂️ ${o.servico}\n📅 ${o.data} às ${o.hora}\n\nSe quiser remarcar, estamos à disposição. 💈`,

	// Cancelamento (feito pelo cliente) → profissional
	bookingCancelledProfessional: (o: MsgData) =>
		`❌ *Cancelamento de cliente*\n\n👤 ${o.cliente}\n✂️ ${o.servico}\n📅 ${o.data} às ${o.hora}\n\nO horário está livre novamente.`,

	// Pedido de remarcação → profissional
	rescheduleRequestProfessional: (o: MsgData) =>
		`🔄 *Solicitação de remarcação*\n\n👤 ${o.cliente}\n✂️ ${o.servico}\n📅 Novo horário pedido: ${o.data} às ${o.hora}\n\nAprove ou recuse no painel.`,

	// Remarcação aprovada → cliente
	rescheduleApprovedClient: (o: MsgData) =>
		`🔄 *Horário alterado*, ${o.nome}!\n\n✂️ ${o.servico}\n📅 Novo horário: ${o.data} às ${o.hora}\n📍 Studio Riquelme\n\nTe esperamos! 💈`,
};
