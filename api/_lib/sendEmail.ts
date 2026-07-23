// Envio de email de reset de senha (Resend, Mailgun ou SendGrid)
// Movido de api/ para lib/ para não contar como Serverless Function no Vercel Hobby.

interface EmailConfig {
	to: string;
	subject: string;
	html: string;
}

export async function sendResetPasswordEmail(
	email: string,
	resetLink: string,
	adminName: string
): Promise<{ success: boolean; error?: string }> {
	const emailProvider = process.env.EMAIL_PROVIDER || 'resend';

	console.log('[SENDEMAIL] Iniciando envio de email:', {
		provider: emailProvider,
		to: email,
		hasLink: !!resetLink,
	});

	if (emailProvider === 'resend') {
		return sendViaResend(email, resetLink, adminName);
	} else if (emailProvider === 'smtp') {
		return sendViaSMTP(email, resetLink, adminName);
	} else {
		return { success: false, error: `EMAIL_PROVIDER não configurado corretamente. Valor: ${emailProvider}. Use 'resend' ou 'smtp'` };
	}
}

async function sendViaResend(
	email: string,
	resetLink: string,
	adminName: string
): Promise<{ success: boolean; error?: string }> {
	const resendApiKey = process.env.RESEND_API_KEY;
	let fromEmail = process.env.EMAIL_FROM || 'noreply@studioriquelme.com.br';

	if (fromEmail.includes('seudominio') || fromEmail.includes('example')) {
		fromEmail = 'noreply@studioriquelme.com.br';
	}
	if (!resendApiKey) {
		return { success: false, error: 'RESEND_API_KEY não configurada' };
	}
	if (!resendApiKey.startsWith('re_')) {
		return { success: false, error: 'RESEND_API_KEY inválida. Deve começar com "re_"' };
	}

	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${resendApiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				from: fromEmail,
				to: email,
				subject: 'Redefinição de Senha - Studio Riquelme',
				html: getEmailTemplate(resetLink, adminName),
			}),
		});

		const responseData = await response.json().catch(() => ({}));
		if (!response.ok) {
			const errorMessage = (responseData as any)?.message || (responseData as any)?.error?.message || (responseData as any)?.error || response.statusText || 'Erro desconhecido';
			return { success: false, error: `Resend API (${response.status}): ${errorMessage}` };
		}
		return { success: true, emailId: (responseData as any)?.id };
	} catch (error: any) {
		return { success: false, error: error?.message || 'Erro ao enviar email via Resend' };
	}
}

async function sendViaSMTP(
	email: string,
	resetLink: string,
	adminName: string
): Promise<{ success: boolean; error?: string }> {
	const smtpService = process.env.SMTP_SERVICE || 'mailgun';
	if (smtpService === 'mailgun') {
		return sendViaMailgun(email, resetLink, adminName);
	} else if (smtpService === 'sendgrid') {
		return sendViaSendGrid(email, resetLink, adminName);
	} else {
		return { success: false, error: 'SMTP_SERVICE não suportado. Use mailgun ou sendgrid' };
	}
}

async function sendViaMailgun(
	email: string,
	resetLink: string,
	adminName: string
): Promise<{ success: boolean; error?: string }> {
	const mailgunApiKey = process.env.MAILGUN_API_KEY;
	const mailgunDomain = process.env.MAILGUN_DOMAIN;
	const fromEmail = process.env.EMAIL_FROM || `noreply@${mailgunDomain}`;

	if (!mailgunApiKey || !mailgunDomain) {
		return { success: false, error: 'MAILGUN_API_KEY e MAILGUN_DOMAIN são obrigatórios' };
	}

	try {
		const credentials = `api:${mailgunApiKey}`;
		const base64Credentials = typeof Buffer !== 'undefined' ? Buffer.from(credentials).toString('base64') : btoa(credentials);
		const formData = new URLSearchParams();
		formData.append('from', fromEmail);
		formData.append('to', email);
		formData.append('subject', 'Redefinição de Senha - Studio Riquelme');
		formData.append('html', getEmailTemplate(resetLink, adminName));

		const response = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
			method: 'POST',
			headers: { 'Authorization': `Basic ${base64Credentials}` },
			body: formData.toString(),
		});

		if (!response.ok) {
			const errorText = await response.text();
			return { success: false, error: `Mailgun: ${errorText}` };
		}
		return { success: true };
	} catch (error: any) {
		return { success: false, error: (error as Error)?.message || 'Erro ao enviar email via Mailgun' };
	}
}

async function sendViaSendGrid(
	email: string,
	resetLink: string,
	adminName: string
): Promise<{ success: boolean; error?: string }> {
	const sendgridApiKey = process.env.SENDGRID_API_KEY;
	const fromEmail = process.env.EMAIL_FROM || 'noreply@studioriquelme.com.br';

	if (!sendgridApiKey) {
		return { success: false, error: 'SENDGRID_API_KEY é obrigatório' };
	}

	try {
		const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${sendgridApiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				personalizations: [{ to: [{ email }] }],
				from: { email: fromEmail },
				subject: 'Redefinição de Senha - Studio Riquelme',
				content: [{ type: 'text/html', value: getEmailTemplate(resetLink, adminName) }],
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			return { success: false, error: `SendGrid: ${errorText}` };
		}
		return { success: true };
	} catch (error: any) {
		return { success: false, error: (error as Error)?.message || 'Erro ao enviar email via SendGrid' };
	}
}

function getEmailTemplate(resetLink: string, adminName: string): string {
	return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Redefinição de Senha</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
	<div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; border: 1px solid #e0e0e0;">
		<h1 style="color: #ec4899; margin-top: 0;">Studio Riquelme</h1>
		<h2 style="color: #333;">Redefinição de Senha</h2>
		<p>Olá, ${adminName || 'Administrador'}!</p>
		<p>Você solicitou a redefinição da sua senha. Clique no botão abaixo para criar uma nova senha:</p>
		<div style="text-align: center; margin: 30px 0;">
			<a href="${resetLink}" style="background-color: #ec4899; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Redefinir Senha</a>
		</div>
		<p style="color: #666; font-size: 14px;">
			Ou copie e cole este link no seu navegador:<br>
			<a href="${resetLink}" style="color: #ec4899; word-break: break-all;">${resetLink}</a>
		</p>
		<p style="color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
			<strong>Importante:</strong> Este link expira em 1 hora e só pode ser usado uma vez. Se você não solicitou esta redefinição, ignore este email.
		</p>
	</div>
	<div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
		<p>Studio Riquelme - Sistema de Agendamento</p>
	</div>
</body>
</html>
	`.trim();
}
