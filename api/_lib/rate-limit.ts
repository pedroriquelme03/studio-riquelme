// Limite de requisições por IP/conta, guardado no Supabase (sql/rate-limit-schema.sql).
// Mantido em _lib/ para não contar como Serverless Function no Vercel Hobby.
//
// As funções serverless não compartilham memória entre si, então o contador
// fica no banco. O incremento é atômico (função SQL `rate_limit_hit`).
//
// Se a tabela/função ainda não existir, ou o banco falhar, o limite NÃO bloqueia
// (fail-open): é preferível ficar sem limite a derrubar login e agendamento.

type Rule = {
	/** Quantas requisições cabem na janela. */
	limit: number;
	/** Tamanho da janela, em segundos. */
	windowSeconds: number;
	/** Bloqueio aplicado ao estourar o limite (padrão: o restante da janela). */
	blockSeconds?: number;
};

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Regras usadas pelas rotas. As chaves são montadas por quem chama. */
export const RATE_RULES = {
	// Login: 5 erros na mesma conta a partir do mesmo IP bloqueiam por 15 minutos.
	loginIpAccount: { limit: 5, windowSeconds: 15 * MINUTE, blockSeconds: 15 * MINUTE },
	// A mesma conta atacada de vários IPs.
	loginAccount: { limit: 10, windowSeconds: 15 * MINUTE, blockSeconds: 15 * MINUTE },
	// O mesmo IP tentando várias contas (o salão inteiro costuma sair por um IP só).
	loginIp: { limit: 20, windowSeconds: 15 * MINUTE, blockSeconds: 30 * MINUTE },

	registerIp: { limit: 5, windowSeconds: HOUR },
	otpRequestIp: { limit: 5, windowSeconds: HOUR },
	otpRequestPhone: { limit: 5, windowSeconds: DAY },
	otpVerifyIp: { limit: 10, windowSeconds: 15 * MINUTE, blockSeconds: 30 * MINUTE },
	adminResetIp: { limit: 5, windowSeconds: HOUR },

	bookingIp: { limit: 10, windowSeconds: HOUR },
	bookingPhone: { limit: 8, windowSeconds: DAY },
} satisfies Record<string, Rule>;

/** IP do cliente. Na Vercel, `x-real-ip` e `x-forwarded-for` são definidos pela plataforma. */
export function getClientIp(req: any): string {
	const real = String(req?.headers?.['x-real-ip'] || '').trim();
	if (real) return real;
	const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
	return forwarded || String(req?.socket?.remoteAddress || 'desconhecido');
}

export type RateResult = { allowed: boolean; retryAfter: number };

/** Conta uma requisição na chave. `allowed: false` quando o limite estourou. */
export async function rateLimitHit(supabase: any, key: string, rule: Rule): Promise<RateResult> {
	try {
		const { data, error } = await supabase.rpc('rate_limit_hit', {
			p_key: key.slice(0, 200),
			p_limit: rule.limit,
			p_window_seconds: rule.windowSeconds,
			p_block_seconds: rule.blockSeconds ?? 0,
		});
		if (error) {
			console.warn('[rate-limit] indisponível, seguindo sem limite:', error.message);
			return { allowed: true, retryAfter: 0 };
		}
		const row = Array.isArray(data) ? data[0] : data;
		return { allowed: row?.allowed !== false, retryAfter: Number(row?.retry_after || 0) };
	} catch (err: any) {
		console.warn('[rate-limit] indisponível, seguindo sem limite:', err?.message || err);
		return { allowed: true, retryAfter: 0 };
	}
}

/** Zera contadores (ex.: depois de um login correto). */
export async function rateLimitReset(supabase: any, keys: string[]): Promise<void> {
	try {
		await supabase.from('rate_limits').delete().in('key', keys.map((k) => k.slice(0, 200)));
	} catch {
		/* noop */
	}
}

/**
 * Aplica várias regras de uma vez. Se alguma estourar, responde 429 e devolve
 * `false` — o handler deve apenas dar `return`.
 */
export async function enforceRateLimits(
	supabase: any,
	res: any,
	checks: Array<[key: string, rule: Rule]>,
): Promise<boolean> {
	const results = await Promise.all(checks.map(([key, rule]) => rateLimitHit(supabase, key, rule)));
	const blocked = results.filter((r) => !r.allowed);
	if (!blocked.length) return true;

	const retryAfter = Math.max(1, ...blocked.map((r) => r.retryAfter));
	const minutes = Math.ceil(retryAfter / 60);
	res.setHeader('Retry-After', String(retryAfter));
	res.status(429).json({
		ok: false,
		code: 'RATE_LIMITED',
		error: `Muitas tentativas. Tente novamente em ${minutes} minuto${minutes === 1 ? '' : 's'}.`,
		retry_after: retryAfter,
	});
	return false;
}
