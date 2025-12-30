// Serviço de envio de mensagens via WhatsApp
// Suporta múltiplas APIs: Evolution API, Z-API, Twilio, etc.

interface WhatsAppConfig {
	apiUrl: string; // URL base da API (ex: https://api.evolutionapi.com ou https://api.z-api.io)
	apiKey?: string; // API Key se necessário
	instanceId?: string; // ID da instância (para Evolution API)
	token?: string; // Token de autenticação
	phoneNumberId?: string; // Phone Number ID (para Twilio/WhatsApp Business API)
}

interface SendMessageParams {
	to: string; // Número do destinatário (formato: 5511999999999)
	message: string; // Mensagem a ser enviada
}

// Formatar número de telefone para formato internacional (sem caracteres especiais)
function formatPhoneNumber(phone: string): string {
	// Remove todos os caracteres não numéricos
	const cleaned = phone.replace(/\D/g, '');
	
	// Se começar com 0, remove
	const withoutZero = cleaned.startsWith('0') ? cleaned.slice(1) : cleaned;
	
	// Se não começar com código do país (55 para Brasil), adiciona
	if (!withoutZero.startsWith('55')) {
		return `55${withoutZero}`;
	}
	
	return withoutZero;
}

// Enviar mensagem via Evolution API (open source, popular no Brasil)
async function sendViaEvolutionAPI(
	config: WhatsAppConfig,
	params: SendMessageParams
): Promise<{ success: boolean; error?: string }> {
	try {
		const phone = formatPhoneNumber(params.to);
		const url = `${config.apiUrl}/message/sendText/${config.instanceId}`;
		
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'apikey': config.apiKey || '',
			},
			body: JSON.stringify({
				number: phone,
				text: params.message,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			return { success: false, error: `Evolution API: ${errorText}` };
		}

		return { success: true };
	} catch (error: any) {
		return { success: false, error: error?.message || 'Erro ao enviar via Evolution API' };
	}
}

// Enviar mensagem via Z-API (serviço brasileiro)
async function sendViaZAPI(
	config: WhatsAppConfig,
	params: SendMessageParams
): Promise<{ success: boolean; error?: string }> {
	try {
		const phone = formatPhoneNumber(params.to);
		const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.token}/send-text`;
		
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				phone: phone,
				message: params.message,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			return { success: false, error: `Z-API: ${errorText}` };
		}

		return { success: true };
	} catch (error: any) {
		return { success: false, error: error?.message || 'Erro ao enviar via Z-API' };
	}
}

// Enviar mensagem via Twilio WhatsApp API
async function sendViaTwilio(
	config: WhatsAppConfig,
	params: SendMessageParams
): Promise<{ success: boolean; error?: string }> {
	try {
		const phone = formatPhoneNumber(params.to);
		const url = `https://api.twilio.com/2010-04-01/Accounts/${config.apiKey}/Messages.json`;
		
		const formData = new URLSearchParams();
		formData.append('From', `whatsapp:${config.phoneNumberId}`);
		formData.append('To', `whatsapp:${phone}`);
		formData.append('Body', params.message);

		// Criar Basic Auth header manualmente
		const credentials = `${config.apiKey}:${config.token}`;
		const base64Credentials = typeof btoa !== 'undefined' 
			? btoa(credentials)
			: Buffer.from(credentials).toString('base64');

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Authorization': `Basic ${base64Credentials}`,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: formData.toString(),
		});

		if (!response.ok) {
			const errorText = await response.text();
			return { success: false, error: `Twilio: ${errorText}` };
		}

		return { success: true };
	} catch (error: any) {
		return { success: false, error: error?.message || 'Erro ao enviar via Twilio' };
	}
}

// Função principal para enviar mensagem (detecta automaticamente o tipo de API)
export async function sendWhatsAppMessage(
	params: SendMessageParams
): Promise<{ success: boolean; error?: string }> {
	// Ler configuração das variáveis de ambiente
	const provider = process.env.WHATSAPP_PROVIDER || 'evolution'; // evolution, zapi, twilio
	const apiUrl = process.env.WHATSAPP_API_URL || '';
	const apiKey = process.env.WHATSAPP_API_KEY || '';
	const instanceId = process.env.WHATSAPP_INSTANCE_ID || '';
	const token = process.env.WHATSAPP_TOKEN || '';
	const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

	if (!apiUrl) {
		return { success: false, error: 'WHATSAPP_API_URL não configurada' };
	}

	const config: WhatsAppConfig = {
		apiUrl,
		apiKey,
		instanceId,
		token,
		phoneNumberId,
	};

	switch (provider.toLowerCase()) {
		case 'evolution':
			if (!instanceId) {
				return { success: false, error: 'WHATSAPP_INSTANCE_ID não configurada para Evolution API' };
			}
			return sendViaEvolutionAPI(config, params);
		
		case 'zapi':
			if (!instanceId || !token) {
				return { success: false, error: 'WHATSAPP_INSTANCE_ID e WHATSAPP_TOKEN são obrigatórios para Z-API' };
			}
			return sendViaZAPI(config, params);
		
		case 'twilio':
			if (!apiKey || !token || !phoneNumberId) {
				return { success: false, error: 'WHATSAPP_API_KEY, WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID são obrigatórios para Twilio' };
			}
			return sendViaTwilio(config, params);
		
		default:
			return { success: false, error: `Provedor WhatsApp não suportado: ${provider}` };
	}
}

// Função auxiliar para formatar mensagem de confirmação de atendimento
export function formatCompletionMessage(
	clientName: string,
	professionalName: string,
	date: string,
	time: string,
	services: Array<{ name: string; price: number }>,
	totalPrice: number
): string {
	const servicesList = services.map(s => `• ${s.name} - R$ ${s.price.toFixed(2)}`).join('\n');
	const dateFormatted = new Date(date).toLocaleDateString('pt-BR', {
		weekday: 'long',
		day: '2-digit',
		month: 'long',
		year: 'numeric',
	});

	return `✅ *Atendimento Realizado!*

Olá ${clientName}!

Seu atendimento foi concluído com sucesso!

*Profissional:* ${professionalName}
*Data:* ${dateFormatted}
*Horário:* ${time}

*Serviços realizados:*
${servicesList}

*Total:* R$ ${totalPrice.toFixed(2)}

Agradecemos pela preferência! Esperamos vê-lo novamente em breve! 🎉`;
}

// Função para formatar mensagem para o profissional
export function formatProfessionalMessage(
	clientName: string,
	date: string,
	time: string,
	services: Array<{ name: string }>,
	totalPrice: number
): string {
	const servicesList = services.map(s => `• ${s.name}`).join('\n');
	const dateFormatted = new Date(date).toLocaleDateString('pt-BR', {
		weekday: 'long',
		day: '2-digit',
		month: 'long',
		year: 'numeric',
	});

	return `✅ *Atendimento Registrado*

Olá!

O atendimento foi marcado como concluído:

*Cliente:* ${clientName}
*Data:* ${dateFormatted}
*Horário:* ${time}

*Serviços:*
${servicesList}

*Total:* R$ ${totalPrice.toFixed(2)}

Bom trabalho! 👏`;
}

