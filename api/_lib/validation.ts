// Validação de entrada no servidor.
// Mantido em _lib/ para não contar como Serverless Function no Vercel Hobby.
//
// Máscaras e limites nos campos do navegador são só conveniência: qualquer um
// pode removê-los pelo inspecionar ou chamar a API direto. O que vale é o que
// está aqui — a API recusa o que não passar.

export class ValidationError extends Error {}

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

function asString(value: unknown): string {
	return typeof value === 'string' ? value : value == null ? '' : String(value);
}

/** Usuário do painel: letras, números, ponto, hífen e sublinhado. */
export function validateUsername(value: unknown): string {
	const username = asString(value).trim();
	if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
		throw new ValidationError('Usuário inválido: use de 3 a 40 letras, números, ponto, hífen ou sublinhado.');
	}
	return username;
}

/** Senha informada no login: só limita o tamanho (a regra de força vale ao criar). */
export function validateLoginPassword(value: unknown): string {
	const password = asString(value);
	if (!password || password.length > 128 || CONTROL_CHARS.test(password)) {
		throw new ValidationError('Senha inválida.');
	}
	return password;
}

/** Senha nova: 8 a 128 caracteres, sem caracteres de controle. */
export function validateNewPassword(value: unknown): string {
	const password = asString(value);
	if (password.length < 8) throw new ValidationError('A senha deve ter pelo menos 8 caracteres');
	if (password.length > 128) throw new ValidationError('A senha deve ter no máximo 128 caracteres');
	if (CONTROL_CHARS.test(password)) throw new ValidationError('A senha contém caracteres inválidos');
	return password;
}

/** Nome de pessoa: letras (com acento), espaço, apóstrofo, ponto e hífen. */
export function validatePersonName(value: unknown, field = 'Nome'): string {
	const name = asString(value).replace(/\s+/g, ' ').trim();
	if (name.length < 2 || name.length > 80) {
		throw new ValidationError(`${field} deve ter de 2 a 80 caracteres.`);
	}
	if (!/^\p{L}[\p{L}\p{M}'’. -]*$/u.test(name)) {
		throw new ValidationError(`${field} inválido: use apenas letras, espaços, hífen e apóstrofo.`);
	}
	return name;
}

/** Telefone brasileiro, só dígitos: DDD + número, com ou sem o 55. */
export function validatePhoneDigits(value: unknown): string {
	const digits = asString(value).replace(/\D/g, '');
	const local = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
	if (!/^[1-9]\d(\d{8}|9\d{8})$/.test(local)) {
		throw new ValidationError('Informe um telefone válido com DDD.');
	}
	return digits;
}

/** E-mail opcional. Devolve `undefined` quando vazio. */
export function validateOptionalEmail(value: unknown): string | undefined {
	const email = asString(value).trim().toLowerCase();
	if (!email) return undefined;
	if (email.length > 120 || !/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/.test(email)) {
		throw new ValidationError('E-mail inválido.');
	}
	return email;
}

/** E-mail obrigatório (cadastro / reset de senha do cliente). */
export function validateRequiredEmail(value: unknown): string {
	const email = validateOptionalEmail(value);
	if (!email) throw new ValidationError('E-mail é obrigatório.');
	if (email.endsWith('@temp.local') || email.startsWith('whatsapp_')) {
		throw new ValidationError('Informe um e-mail válido.');
	}
	return email;
}

/** Texto livre curto (observações). Remove caracteres de controle e limita o tamanho. */
export function sanitizeNotes(value: unknown, max = 500): string | null {
	const text = asString(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
	if (!text) return null;
	if (text.length > max) throw new ValidationError(`Observações devem ter no máximo ${max} caracteres.`);
	return text;
}

/** Data AAAA-MM-DD existente no calendário. */
export function validateDate(value: unknown): string {
	const date = asString(value).trim();
	const parsed = new Date(`${date}T12:00:00Z`);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
		throw new ValidationError('Data inválida (use AAAA-MM-DD).');
	}
	return date;
}

/** Hora HH:MM ou HH:MM:SS. Devolve sempre HH:MM:SS. */
export function validateTime(value: unknown): string {
	const time = asString(value).trim();
	const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(time);
	if (!match) throw new ValidationError('Horário inválido (use HH:MM).');
	return `${match[1]}:${match[2]}:${match[3] || '00'}`;
}

/** UUID (IDs de profissional, promoção, agendamento). */
export function validateUuid(value: unknown, field: string): string {
	const id = asString(value).trim();
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
		throw new ValidationError(`${field} inválido.`);
	}
	return id;
}

/** Lista de serviços do agendamento: de 1 a 10 itens, quantidade de 1 a 5. */
export function validateBookingServices(value: unknown): Array<Record<string, any>> {
	if (!Array.isArray(value)) return [];
	if (value.length > 10) throw new ValidationError('Máximo de 10 serviços por agendamento.');
	return value.map((item: any) => {
		const id = Number(item?.id);
		const quantity = item?.quantity == null ? 1 : Number(item.quantity);
		if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Serviço inválido.');
		if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
			throw new ValidationError('Quantidade inválida.');
		}
		return { ...item, id, quantity };
	});
}
