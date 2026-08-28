import { createHmac, timingSafeEqual } from 'node:crypto';
import {
	buildPlanSnapshot,
	createBenefitCyclesForSubscription,
	mapSubscriptionStatusFromGateway,
} from './monthly-plans.js';

function getWebhookSecret(): string {
	const secret = process.env.ABACATEPAY_WEBHOOK_SECRET?.trim();
	if (!secret) throw new Error('ABACATEPAY_WEBHOOK_SECRET não configurada');
	return secret;
}

function getPublicKey(): string {
	const key = process.env.ABACATEPAY_PUBLIC_KEY?.trim();
	if (!key) throw new Error('ABACATEPAY_PUBLIC_KEY não configurada');
	return key;
}

export function verifyAbacatePayWebhook(req: any, rawBody: string): boolean {
	const url = new URL(req?.url || '/', 'http://localhost');
	const secretParam = url.searchParams.get('webhookSecret');
	if (secretParam !== getWebhookSecret()) return false;

	const signature = String(req.headers?.['x-webhook-signature'] || req.headers?.['X-Webhook-Signature'] || '');
	if (!signature) return false;

	const expected = createHmac('sha256', getPublicKey()).update(rawBody, 'utf8').digest('base64');
	try {
		return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
	} catch {
		return false;
	}
}

async function logSubscriptionEvent(supabase: any, subscriptionId: string | null, eventType: string, payload: any) {
	await supabase.from('subscription_events').insert({
		subscription_id: subscriptionId,
		event_type: eventType,
		payload,
	});
}

async function activateSubscription(
	supabase: any,
	subscriptionRow: any,
	gatewaySub: any,
	eventId: string,
) {
	const now = new Date();
	const status = mapSubscriptionStatusFromGateway(gatewaySub?.status);
	const updates: Record<string, unknown> = {
		status: status === 'awaiting_payment' ? 'active' : status,
		abacatepay_subscription_id: gatewaySub?.id || subscriptionRow.abacatepay_subscription_id,
		subscribed_at: subscriptionRow.subscribed_at || now.toISOString(),
		last_payment_at: now.toISOString(),
		updated_at: now.toISOString(),
	};
	if (gatewaySub?.trialEndsAt) {
		updates.next_billing_at = gatewaySub.trialEndsAt;
	}

	await supabase.from('client_subscriptions').update(updates).eq('id', subscriptionRow.id);

	await supabase.from('subscription_payments').insert({
		subscription_id: subscriptionRow.id,
		amount: gatewaySub?.amount != null ? Number(gatewaySub.amount) / 100 : subscriptionRow.contracted_price,
		paid_at: now.toISOString(),
		abacatepay_event_id: eventId,
		status: 'paid',
	});

	const { data: existingCycles } = await supabase
		.from('subscription_benefit_cycles')
		.select('id')
		.eq('subscription_id', subscriptionRow.id)
		.limit(1);
	if (!existingCycles?.length) {
		await createBenefitCyclesForSubscription(
			supabase,
			subscriptionRow.id,
			subscriptionRow.plan_snapshot,
			now,
		);
	}

	await logSubscriptionEvent(supabase, subscriptionRow.id, 'activated', { gatewaySub });
}

async function renewSubscription(supabase: any, subscriptionRow: any, gatewaySub: any, eventId: string) {
	const now = new Date();
	await supabase.from('client_subscriptions').update({
		status: 'active',
		last_payment_at: now.toISOString(),
		next_billing_at: gatewaySub?.nextBillingAt || null,
		updated_at: now.toISOString(),
	}).eq('id', subscriptionRow.id);

	await supabase.from('subscription_payments').insert({
		subscription_id: subscriptionRow.id,
		amount: gatewaySub?.amount != null ? Number(gatewaySub.amount) / 100 : subscriptionRow.contracted_price,
		paid_at: now.toISOString(),
		abacatepay_event_id: eventId,
		status: 'paid',
	});

	await createBenefitCyclesForSubscription(
		supabase,
		subscriptionRow.id,
		subscriptionRow.plan_snapshot,
		now,
	);

	await logSubscriptionEvent(supabase, subscriptionRow.id, 'renewed', { gatewaySub });
}

async function cancelSubscription(supabase: any, subscriptionRow: any, gatewaySub: any, eventId: string) {
	const now = new Date();
	await supabase.from('client_subscriptions').update({
		status: 'cancelled',
		cancelled_at: gatewaySub?.canceledAt || now.toISOString(),
		updated_at: now.toISOString(),
	}).eq('id', subscriptionRow.id);

	await logSubscriptionEvent(supabase, subscriptionRow.id, 'cancelled', {
		gatewaySub,
		cancelledDueTo: gatewaySub?.cancelledDueTo || null,
	});
}

async function findSubscriptionForEvent(supabase: any, payload: any) {
	const gatewaySub = payload?.data?.subscription;
	const metadata = payload?.data?.metadata || gatewaySub?.metadata || {};
	const externalId = metadata?.subscription_id
		|| metadata?.subscriptionId
		|| gatewaySub?.externalId
		|| payload?.data?.externalId;
	const gatewaySubId = gatewaySub?.id;

	let query = supabase.from('client_subscriptions').select('*');
	if (externalId) query = query.eq('id', String(externalId));
	else if (gatewaySubId) query = query.eq('abacatepay_subscription_id', String(gatewaySubId));
	else return null;

	const { data } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
	return data;
}

export async function processAbacatePayWebhook(supabase: any, payload: any) {
	const eventId = String(payload?.id || '');
	const eventType = String(payload?.event || '');
	if (!eventId || !eventType) {
		throw new Error('Payload de webhook inválido');
	}

	const { data: existing } = await supabase
		.from('abacatepay_webhook_events')
		.select('id')
		.eq('id', eventId)
		.maybeSingle();
	if (existing?.id) {
		return { duplicate: true };
	}

	const subscriptionRow = await findSubscriptionForEvent(supabase, payload);

	switch (eventType) {
		case 'subscription.completed':
		case 'subscription.trial_started':
			if (subscriptionRow) {
				await activateSubscription(supabase, subscriptionRow, payload?.data?.subscription, eventId);
			}
			break;
		case 'subscription.renewed':
			if (subscriptionRow) {
				await renewSubscription(supabase, subscriptionRow, payload?.data?.subscription, eventId);
			}
			break;
		case 'subscription.cancelled':
			if (subscriptionRow) {
				await cancelSubscription(supabase, subscriptionRow, payload?.data?.subscription, eventId);
			}
			break;
		default:
			break;
	}

	await supabase.from('abacatepay_webhook_events').insert({
		id: eventId,
		event_type: eventType,
		subscription_id: subscriptionRow?.id || null,
	});

	return { duplicate: false, eventType, subscriptionId: subscriptionRow?.id || null };
}

export { buildPlanSnapshot };
