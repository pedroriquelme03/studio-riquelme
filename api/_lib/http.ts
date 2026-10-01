// Respostas de erro sem detalhes internos.
// Mantido em _lib/ para não contar como Serverless Function no Vercel Hobby.

const GENERIC_ERROR = 'Erro interno. Tente novamente em instantes.';

/**
 * Faz com que respostas 5xx nunca levem ao navegador o texto do erro interno
 * (mensagens do Postgres, nomes de tabelas e colunas, variáveis de ambiente
 * ausentes). O detalhe original vai só para o log do servidor.
 *
 * Erros 4xx não são alterados: são mensagens escritas para o usuário.
 * Chame uma vez, no início do handler.
 */
export function hardenErrors(req: any, res: any): void {
	if (res.__hardened) return;
	res.__hardened = true;

	const originalJson = res.json.bind(res);
	res.json = (body: any) => {
		const status = Number(res.statusCode || 200);
		if (status >= 500 && body && typeof body === 'object') {
			const path = String(req?.url || '').split('?')[0];
			console.error(`[api] ${req?.method} ${path} → ${status}:`, body.error ?? body);
			const { error: _error, details: _details, ...rest } = body;
			return originalJson({ ...rest, ok: false, error: GENERIC_ERROR });
		}
		return originalJson(body);
	};
}
