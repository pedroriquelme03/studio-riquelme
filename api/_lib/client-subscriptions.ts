import {
	cancelAbacatePaySubscription,
	createSubscriptionCheckout,
	ensureAbacatePayCustomer,
	getFrontendBaseUrl,
} from './abacatepay.js';
import {
	buildPlanSnapshot,
	getActiveSubscriptionForClient,
	getBenefitAvailability,
	getCurrentBenefitCycles,
	isMissingMonthlyPlansError,
	loadPlanServicesMap,
	mapPlanRow,
	countReservedUsage,
} from './monthly-plans.js';

export async function getMyPlanResponse(supabase: any, clientId: string) {
	const { data: subscriptions, error } = await supabase
		.from('client_subscriptions')
		.select('*')
		.eq('client_id', clientId)
		.order('created_at', { ascending: false })
		.limit(20);
	if (error) {
		if (isMissingMonthlyPlansError(error.message)) return { ok: true, active: null, history: [] };
		throw error;
	}

	const active = (subscriptions || []).find((s: any) => ['active', 'past_due', 'awaiting_payment'].includes(s.status)) || null;
	let benefits: any[] = [];
	if (active && active.status === 'active') {
		const cycles = await getCurrentBenefitCycles(supabase, active.id);
		benefits = await Promise.all(cycles.map(async (cycle: any) => {
			const reserved = await countReservedUsage(supabase, cycle.id);
			const allocated = Number(cycle.quantity_allocated || 0);
			const used = Number(cycle.quantity_used || 0);
			return {
				serviceId: Number(cycle.service_id),
				serviceName: cycle.service_name,
				allocated,
				used,
				reserved,
				remaining: Math.max(0, allocated - used - reserved),
				cycleStart: cycle.cycle_start,
				cycleEnd: cycle.cycle_end,
			};
		}));
	}

	return {
		ok: true,
		active: active ? {
			id: active.id,
			status: active.status,
			planName: active.plan_snapshot?.planName || '',
			monthlyPrice: Number(active.contracted_price),
			benefits: active.plan_snapshot?.benefits || [],
			rulesNotes: active.plan_snapshot?.rulesNotes || '',
			services: benefits,
			subscribedAt: active.subscribed_at,
			lastPaymentAt: active.last_payment_at,
			nextBillingAt: active.next_billing_at,
			cancelledAt: active.cancelled_at,
		} : null,
		history: (subscriptions || []).map((s: any) => ({
			id: s.id,
			status: s.status,
			planName: s.plan_snapshot?.planName || '',
			monthlyPrice: Number(s.contracted_price),
			subscribedAt: s.subscribed_at,
			cancelledAt: s.cancelled_at,
			createdAt: s.created_at,
		})),
	};
}

export async function subscribeToPlan(supabase: any, clientId: string, planId: string) {
	const active = await getActiveSubscriptionForClient(supabase, clientId);
	if (active) {
		throw Object.assign(new Error('Você já possui uma assinatura ativa ou em processamento'), { status: 409 });
	}

	const { data: planRow, error: planErr } = await supabase
		.from('monthly_plans')
		.select('*')
		.eq('id', planId)
		.eq('is_active', true)
		.single();
	if (planErr || !planRow) {
		throw Object.assign(new Error('Plano não encontrado ou inativo'), { status: 404 });
	}
	if (!planRow.abacatepay_product_id) {
		throw Object.assign(new Error('Plano ainda não está disponível para assinatura. Contate o suporte.'), { status: 503 });
	}

	const servicesMap = await loadPlanServicesMap(supabase, [String(planRow.id)]);
	const plan = mapPlanRow(planRow, servicesMap.get(String(planRow.id)) || []);
	const snapshot = buildPlanSnapshot({
		id: plan.id,
		name: plan.name,
		monthlyPrice: plan.monthlyPrice,
		benefits: plan.benefits,
		rulesNotes: plan.rulesNotes,
		services: plan.services.map((s) => ({
			serviceId: s.serviceId,
			serviceName: s.serviceName,
			quantityPerMonth: s.quantityPerMonth,
		})),
	});

	const { data: client, error: clientErr } = await supabase
		.from('clients')
		.select('id, name, phone, email, abacatepay_customer_id')
		.eq('id', clientId)
		.single();
	if (clientErr || !client) throw Object.assign(new Error('Cliente não encontrado'), { status: 404 });

	const { data: subscription, error: subErr } = await supabase
		.from('client_subscriptions')
		.insert({
			client_id: clientId,
			plan_id: planId,
			status: 'awaiting_payment',
			contracted_price: plan.monthlyPrice,
			plan_snapshot: snapshot,
		})
		.select('id')
		.single();
	if (subErr) throw subErr;

	const baseUrl = getFrontendBaseUrl();
	const customerId = await ensureAbacatePayCustomer({
		id: String(client.id),
		name: client.name,
		email: client.email,
		phone: client.phone,
		abacatepayCustomerId: client.abacatepay_customer_id,
	});

	await supabase.from('clients').update({ abacatepay_customer_id: customerId }).eq('id', clientId);

	const checkout = await createSubscriptionCheckout({
		productId: planRow.abacatepay_product_id,
		customerId,
		externalId: String(subscription.id),
		metadata: {
			subscription_id: subscription.id,
			client_id: clientId,
			plan_id: planId,
		},
		returnUrl: `${baseUrl}/planos-mensais`,
		completionUrl: `${baseUrl}/meu-plano?checkout=returned`,
	});

	await supabase.from('client_subscriptions').update({
		abacatepay_checkout_id: checkout.id,
		abacatepay_customer_id: customerId,
		updated_at: new Date().toISOString(),
	}).eq('id', subscription.id);

	await supabase.from('subscription_events').insert({
		subscription_id: subscription.id,
		event_type: 'checkout_created',
		payload: { checkoutId: checkout.id },
	});

	return {
		ok: true,
		subscriptionId: subscription.id,
		checkoutUrl: checkout.url,
		status: 'awaiting_payment',
	};
}

export async function cancelClientSubscription(supabase: any, clientId: string) {
	const active = await getActiveSubscriptionForClient(supabase, clientId);
	if (!active) {
		throw Object.assign(new Error('Nenhuma assinatura ativa encontrada'), { status: 404 });
	}

	if (active.abacatepay_subscription_id) {
		await cancelAbacatePaySubscription(active.abacatepay_subscription_id);
	}

	const now = new Date().toISOString();
	await supabase.from('client_subscriptions').update({
		status: 'cancelled',
		cancelled_at: now,
		updated_at: now,
	}).eq('id', active.id);

	await supabase.from('subscription_events').insert({
		subscription_id: active.id,
		event_type: 'cancel_requested',
		payload: { by: 'client' },
	});

	return { ok: true };
}

export async function getPlanBenefitForService(supabase: any, clientId: string, serviceId: number) {
	const availability = await getBenefitAvailability(supabase, clientId, serviceId);
	if (!availability) return { ok: true, available: false };
	return {
		ok: true,
		available: availability.remaining > 0,
		...availability,
	};
}
