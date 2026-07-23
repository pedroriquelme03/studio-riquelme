// Sessões assinadas (HMAC-SHA256) para admins e clientes.
// Mantido em lib/ para não contar como Serverless Function no Vercel Hobby.
//
// Token: v1.<base64url(payload)>.<base64url(hmac)>
// O payload é legível, mas não pode ser forjado sem SESSION_SECRET.

import { createHmac, timingSafeEqual, randomBytes, scryptSync, createHash } from 'node:crypto';

export const ADMIN_COOKIE = 'sr_admin';
export const CLIENT_COOKIE = 'sr_client';

const ADMIN_TTL_SECONDS = 12 * 60 * 60;       // 12 horas
const CLIENT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 dias

export type AdminSession = {
	role: 'admin';
	sub: string;      // admins.id
	username: string;
	name?: string;
	exp: number;      // epoch em segundos
};

export type ClientSession = {
	role: 'client';
	sub: string;   // clients.id
	phone: string; // apenas dígitos
	exp: number;
};

export type Session = AdminSession | ClientSession;

function getSecret(): string {
	const secret = process.env.SESSION_SECRET || '';
	if (secret.length < 32) {
		throw new Error(
			'SESSION_SECRET não configurada (mínimo 32 caracteres). Gere com: openssl rand -hex 32',
		);
	}
	return secret;
}

function b64url(input: Buffer | string): string {
	return Buffer.from(input as any)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

function b64urlDecode(input: string): Buffer {
	const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
	return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(payloadB64: string, secret: string): string {
	return b64url(createHmac('sha256', secret).update(`v1.${payloadB64}`).digest());
}

/** Gera um token de sessão assinado. */
export function createSessionToken(
	data: Omit<AdminSession, 'exp'> | Omit<ClientSession, 'exp'>,
): { token: string; maxAge: number } {
	const secret = getSecret();
	const maxAge = data.role === 'admin' ? ADMIN_TTL_SECONDS : CLIENT_TTL_SECONDS;
	const payload = { ...data, exp: Math.floor(Date.now() / 1000) + maxAge };
	const payloadB64 = b64url(JSON.stringify(payload));
	return { token: `v1.${payloadB64}.${sign(payloadB64, secret)}`, maxAge };
}

/** Verifica assinatura e expiração. Retorna null se inválido. */
export function verifySessionToken(token: string | undefined | null): Session | null {
	if (!token) return null;
	let secret: string;
	try {
		secret = getSecret();
	} catch {
		return null; // sem segredo configurado, nenhuma sessão é válida (fail-closed)
	}

	const parts = token.split('.');
	if (parts.length !== 3 || parts[0] !== 'v1') return null;

	const [, payloadB64, sigB64] = parts;
	const expected = sign(payloadB64, secret);

	const a = Buffer.from(sigB64);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

	try {
		const payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8')) as Session;
		if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
		if (payload.role !== 'admin' && payload.role !== 'client') return null;
		return payload;
	} catch {
		return null;
	}
}

function parseCookies(req: any): Record<string, string> {
	const header = req?.headers?.cookie || '';
	const out: Record<string, string> = {};
	for (const part of String(header).split(';')) {
		const idx = part.indexOf('=');
		if (idx === -1) continue;
		const k = part.slice(0, idx).trim();
		if (k) out[k] = decodeURIComponent(part.slice(idx + 1).trim());
	}
	return out;
}

function isSecureEnv(): boolean {
	return process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
}

export function buildSessionCookie(name: string, token: string, maxAge: number): string {
	const attrs = [
		`${name}=${token}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Strict',
		`Max-Age=${maxAge}`,
	];
	if (isSecureEnv()) attrs.push('Secure');
	return attrs.join('; ');
}

export function buildClearCookie(name: string): string {
	const attrs = [`${name}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
	if (isSecureEnv()) attrs.push('Secure');
	return attrs.join('; ');
}

/** Anexa um Set-Cookie preservando os já definidos na resposta. */
export function appendCookie(res: any, cookie: string): void {
	const existing = res.getHeader?.('Set-Cookie');
	if (!existing) {
		res.setHeader('Set-Cookie', [cookie]);
		return;
	}
	res.setHeader('Set-Cookie', Array.isArray(existing) ? [...existing, cookie] : [existing, cookie]);
}

/** Lê a sessão do cookie ou do header Authorization: Bearer. */
export function getSession(req: any, expected?: 'admin' | 'client'): Session | null {
	const cookies = parseCookies(req);
	const cookieName = expected === 'client' ? CLIENT_COOKIE : ADMIN_COOKIE;

	const candidates = [
		cookies[cookieName],
		// sem 'expected' explícito, tenta os dois cookies
		...(expected ? [] : [cookies[CLIENT_COOKIE]]),
	];

	const authHeader = String(req?.headers?.authorization || '');
	if (authHeader.toLowerCase().startsWith('bearer ')) {
		candidates.push(authHeader.slice(7).trim());
	}

	for (const token of candidates) {
		const session = verifySessionToken(token);
		if (session && (!expected || session.role === expected)) return session;
	}
	return null;
}

/**
 * Exige sessão de admin. Em caso de falha, já responde 401/500 e retorna null —
 * o handler deve apenas dar `return`.
 */
export function requireAdmin(req: any, res: any): AdminSession | null {
	if (!process.env.SESSION_SECRET) {
		res.status(500).json({ ok: false, error: 'SESSION_SECRET não configurada no servidor' });
		return null;
	}
	const session = getSession(req, 'admin');
	if (!session || session.role !== 'admin') {
		res.status(401).json({ ok: false, error: 'Não autorizado' });
		return null;
	}
	return session;
}

/** Exige sessão de cliente. Mesmo contrato de requireAdmin. */
export function requireClient(req: any, res: any): ClientSession | null {
	if (!process.env.SESSION_SECRET) {
		res.status(500).json({ ok: false, error: 'SESSION_SECRET não configurada no servidor' });
		return null;
	}
	const session = getSession(req, 'client');
	if (!session || session.role !== 'client') {
		res.status(401).json({ ok: false, error: 'Não autorizado' });
		return null;
	}
	return session;
}

// ── Hash de senha (scrypt com salt) ────────────────────────────────────────
// Formato: scrypt$<N>$<saltHex>$<hashHex>
// Substitui o SHA-256 sem salt usado anteriormente.

const SCRYPT_N = 16384;
const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
	const salt = randomBytes(16);
	const hash = scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N });
	return `scrypt$${SCRYPT_N}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/**
 * Verifica a senha. Aceita o formato legado (SHA-256 hex sem salt) para não
 * derrubar logins existentes — o chamador deve reescrever o hash quando
 * `needsRehash` for true.
 */
export function verifyPassword(
	password: string,
	stored: string | null | undefined,
): { valid: boolean; needsRehash: boolean } {
	const value = String(stored || '');
	if (!value) return { valid: false, needsRehash: false };

	if (value.startsWith('scrypt$')) {
		const [, nStr, saltHex, hashHex] = value.split('$');
		const N = Number(nStr);
		if (!N || !saltHex || !hashHex) return { valid: false, needsRehash: false };
		try {
			const expected = Buffer.from(hashHex, 'hex');
			const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, { N });
			return { valid: timingSafeEqual(expected, actual), needsRehash: false };
		} catch {
			return { valid: false, needsRehash: false };
		}
	}

	// Legado: SHA-256 hex puro.
	if (/^[a-f0-9]{64}$/i.test(value)) {
		const legacy = createHash('sha256').update(password).digest('hex');
		const a = Buffer.from(legacy, 'hex');
		const b = Buffer.from(value.toLowerCase(), 'hex');
		const valid = a.length === b.length && timingSafeEqual(a, b);
		return { valid, needsRehash: valid };
	}

	return { valid: false, needsRehash: false };
}

/** Compara dois segredos curtos (códigos OTP, tokens) sem vazar timing. */
export function safeEqual(a: string, b: string): boolean {
	const ba = Buffer.from(String(a));
	const bb = Buffer.from(String(b));
	return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Hash determinístico para tokens/códigos guardados no banco. */
export function tokenHash(value: string): string {
	return createHash('sha256').update(String(value)).digest('hex');
}
