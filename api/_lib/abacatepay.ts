const ABACATEPAY_BASE = 'https://api.abacatepay.com/v2';

export function getAbacatePayApiKey(): string {
	const key = process.env.ABACATEPAY_API_KEY?.trim();
	if (!key) throw new Error('ABACATEPAY_API_KEY não configurada');
	return key;
}

export function getFrontendBaseUrl(): string {
	const fromEnv = process.env.FRONTEND_URL?.trim() || process.env.VERCEL_URL?.trim();
	if (!fromEnv) return 'http://localhost:5173';
	if (fromEnv.startsWith('http')) return fromEnv.replace(/\/$/, '');
	return `https://${fromEnv.replace(/\/$/, '')}`;
}

export async function abacatePayPost<T = any>(path: string, body: Record<string, unknown>): Promise<T> {
	const res = await fetch(`${ABACATEPAY_BASE}${path}`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${getAbacatePayApiKey()}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});
	const json = await res.json().catch(() => ({}));
	if (!res.ok || json?.success === false) {
		const msg = json?.error || json?.message || `AbacatePay HTTP ${res.status}`;
		throw new Error(typeof msg === 'string' ? msg : 'Erro na AbacatePay');
	}
	return (json?.data ?? json) as T;
}

export async function syncAbacatePayProduct(plan: {
	id: string;
	name: string;
	description?: string;
	monthlyPrice: number;
	imageUrl?: string | null;
	abacatepayProductId?: string | null;
}): Promise<string> {
	const priceCents = Math.round(Number(plan.monthlyPrice) * 100);
	const payload: Record<string, unknown> = {
		externalId: plan.id,
		name: plan.name,
		price: priceCents,
		currency: 'BRL',
		cycle: 'MONTHLY',
		description: plan.description || '',
	};
	if (plan.imageUrl) payload.imageUrl = plan.imageUrl;

	if (plan.abacatepayProductId) {
		try {
			const updated = await abacatePayPost<{ id: string }>('/products/update', {
				id: plan.abacatepayProductId,
				...payload,
			});
			return String(updated.id || plan.abacatepayProductId);
		} catch {
			// Produto pode ter sido removido no gateway — recria.
		}
	}

	const created = await abacatePayPost<{ id: string }>('/products/create', payload);
	return String(created.id);
}

export async function ensureAbacatePayCustomer(client: {
	id: string;
	name: string;
	email?: string | null;
	phone: string;
	abacatepayCustomerId?: string | null;
}): Promise<string> {
	if (client.abacatepayCustomerId) return client.abacatepayCustomerId;

	const digits = String(client.phone || '').replace(/\D/g, '');
	const email = client.email?.trim()
		|| (digits ? `whatsapp_${digits}@client.studioriquelme.local` : `client_${client.id}@client.studioriquelme.local`);

	const created = await abacatePayPost<{ id: string }>('/customers/create', {
		email,
		name: client.name,
		cellphone: digits ? `+55${digits}` : undefined,
		metadata: { client_id: client.id },
	});
	return String(created.id);
}

export async function createSubscriptionCheckout(input: {
	productId: string;
	customerId: string;
	externalId: string;
	metadata: Record<string, unknown>;
	returnUrl: string;
	completionUrl: string;
}) {
	return abacatePayPost<{
		id: string;
		url: string;
		status: string;
	}>('/subscriptions/create', {
		items: [{ id: input.productId, quantity: 1 }],
		customerId: input.customerId,
		externalId: input.externalId,
		metadata: input.metadata,
		returnUrl: input.returnUrl,
		completionUrl: input.completionUrl,
		methods: ['CARD'],
		retryPolicy: { maxRetry: 3, retryEvery: 2 },
	});
}

export async function cancelAbacatePaySubscription(subscriptionId: string) {
	return abacatePayPost('/subscriptions/cancel', { id: subscriptionId });
}
