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
): Promise<{ success: boolean; error?: string; emailId?: string }> {
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
	const safeName = String(adminName || 'cliente')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
	const safeLink = String(resetLink || '')
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');

	return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta name="color-scheme" content="dark">
	<title>Redefinição de Senha — Studio Riquelme</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0b0b;font-family:Georgia,'Times New Roman',serif;line-height:1.6;color:#f5f5f5;-webkit-font-smoothing:antialiased;">
	<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0b0b0b;padding:32px 16px;">
		<tr>
			<td align="center">
				<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#141414;border:1px solid #2e2e2e;border-radius:16px;overflow:hidden;">
					<tr>
						<td style="padding:28px 32px 20px;border-bottom:1px solid #2e2e2e;text-align:center;">
							<p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;letter-spacing:0.04em;color:#d4af37;">
								Studio Riquelme
							</p>
							<p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#a8892a;">
								Redefinição de senha
							</p>
						</td>
					</tr>
					<tr>
						<td style="padding:32px;">
							<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#f5f5f5;">
								Olá, ${safeName}!
							</p>
							<p style="margin:0 0 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#c4c4c4;">
								Você solicitou a redefinição da sua senha. Clique no botão abaixo para criar uma nova senha:
							</p>
							<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
								<tr>
									<td align="center" style="padding:8px 0 28px;">
										<a href="${safeLink}" style="display:inline-block;background-color:#d4af37;background-image:linear-gradient(135deg,#e2c35a 0%,#d4af37 45%,#a8892a 100%);color:#111111;padding:14px 32px;text-decoration:none;border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;letter-spacing:0.02em;">
											Redefinir senha
										</a>
									</td>
								</tr>
							</table>
							<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8a8a8a;">
								Ou copie e cole este link no seu navegador:
							</p>
							<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;word-break:break-all;">
								<a href="${safeLink}" style="color:#d4af37;text-decoration:underline;">${safeLink}</a>
							</p>
						</td>
					</tr>
					<tr>
						<td style="padding:20px 32px 28px;border-top:1px solid #2e2e2e;">
							<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a8a8a;line-height:1.5;">
								<strong style="color:#c4c4c4;">Importante:</strong> Este link expira em 1 hora e só pode ser usado uma vez. Se você não solicitou esta redefinição, ignore este e-mail.
							</p>
						</td>
					</tr>
				</table>
				<p style="margin:24px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5a5a5a;text-align:center;">
					Studio Riquelme · Sistema de Agendamento
				</p>
			</td>
		</tr>
	</table>
</body>
</html>
	`.trim();
}
