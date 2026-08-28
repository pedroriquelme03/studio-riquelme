export function isMissingMonthlyPlansError(message: string): boolean {
	return /monthly_plans|client_subscriptions|subscription_benefit/i.test(message);
}

export function mapPlanRow(row: any, services: any[] = []) {
	return {
		id: row.id,
		name: row.name,
		description: row.description || '',
		monthlyPrice: Number(row.monthly_price),
		imageUrl: row.image_url || null,
		benefits: Array.isArray(row.benefits) ? row.benefits : [],
		rulesNotes: row.rules_notes || '',
		displayOrder: Number(row.display_order || 0),
		isFeatured: row.is_featured === true,
		isActive: row.is_active !== false,
		abacatepayProductId: row.abacatepay_product_id || null,
		services: services.map((s) => ({
			serviceId: Number(s.service_id),
			serviceName: s.services?.name || s.service_name || '',
			quantityPerMonth: Number(s.quantity_per_month),
			sortOrder: Number(s.sort_order || 0),
		})).sort((a, b) => a.sortOrder - b.sortOrder),
	};
}

export function buildPlanSnapshot(plan: {
	id: string;
	name: string;
	monthlyPrice: number;
	benefits: string[];
	rulesNotes?: string;
	services: Array<{ serviceId: number; serviceName: string; quantityPerMonth: number }>;
}) {
	return {
		planId: plan.id,
		planName: plan.name,
		monthlyPrice: plan.monthlyPrice,
		benefits: plan.benefits,
		rulesNotes: plan.rulesNotes || '',
		services: plan.services.map((s) => ({
			serviceId: s.serviceId,
			serviceName: s.serviceName,
			quantityPerMonth: s.quantityPerMonth,
		})),
		snapshotAt: new Date().toISOString(),
	};
}

export function mapSubscriptionStatusFromGateway(status?: string | null): string {
	switch (String(status || '').toUpperCase()) {
		case 'ACTIVE':
			return 'active';
		case 'PENDING':
			return 'awaiting_payment';
		case 'CANCELLED':
			return 'cancelled';
		case 'EXPIRED':
			return 'expired';
		case 'FAILED':
			return 'payment_failed';
		default:
			return 'awaiting_payment';
	}
}

export function addMonths(date: Date, months: number): Date {
	const d = new Date(date);
	d.setMonth(d.getMonth() + months);
	return d;
}

export function toDateOnly(d: Date): string {
	return d.toISOString().slice(0, 10);
}

export async function loadPlanServicesMap(supabase: any, planIds: string[]) {
	const map = new Map<string, any[]>();
	if (!planIds.length) return map;
	const { data, error } = await supabase
		.from('monthly_plan_services')
		.select('plan_id, service_id, quantity_per_month, sort_order, services:service_id ( id, name )')
		.in('plan_id', planIds);
	if (error) throw error;
	for (const row of data || []) {
		const pid = String(row.plan_id);
		const list = map.get(pid) || [];
		list.push(row);
		map.set(pid, list);
	}
	return map;
}

export async function createBenefitCyclesForSubscription(
	supabase: any,
	subscriptionId: string,
	snapshot: any,
	cycleStart: Date,
) {
	const cycleEnd = addMonths(cycleStart, 1);
	const services = Array.isArray(snapshot?.services) ? snapshot.services : [];
	if (!services.length) return;

	const rows = services.map((s: any) => ({
		subscription_id: subscriptionId,
		cycle_start: toDateOnly(cycleStart),
		cycle_end: toDateOnly(cycleEnd),
		service_id: Number(s.serviceId),
		service_name: String(s.serviceName || ''),
		quantity_allocated: Number(s.quantityPerMonth || 0),
		quantity_used: 0,
	}));

	const { error } = await supabase.from('subscription_benefit_cycles').insert(rows);
	if (error) throw error;
}

export async function getActiveSubscriptionForClient(supabase: any, clientId: string) {
	const { data, error } = await supabase
		.from('client_subscriptions')
		.select('*')
		.eq('client_id', clientId)
		.in('status', ['active', 'past_due'])
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (error) throw error;
	return data;
}

export async function getCurrentBenefitCycles(supabase: any, subscriptionId: string) {
	const today = toDateOnly(new Date());
	const { data, error } = await supabase
		.from('subscription_benefit_cycles')
		.select('*')
		.eq('subscription_id', subscriptionId)
		.lte('cycle_start', today)
		.gte('cycle_end', today);
	if (error) throw error;
	return data || [];
}

export async function countReservedUsage(supabase: any, cycleId: string): Promise<number> {
	const { data, error } = await supabase
		.from('subscription_benefit_usage')
		.select('quantity')
		.eq('cycle_id', cycleId)
		.eq('status', 'reserved');
	if (error) throw error;
	return (data || []).reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0);
}

export async function getBenefitAvailability(
	supabase: any,
	clientId: string,
	serviceId: number,
) {
	const { data: sub, error } = await supabase
		.from('client_subscriptions')
		.select('*')
		.eq('client_id', clientId)
		.eq('status', 'active')
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (error) throw error;
	if (!sub) return null;

	const cycles = await getCurrentBenefitCycles(supabase, sub.id);
	const cycle = cycles.find((c: any) => Number(c.service_id) === Number(serviceId));
	if (!cycle) return null;

	const reserved = await countReservedUsage(supabase, cycle.id);
	const allocated = Number(cycle.quantity_allocated || 0);
	const used = Number(cycle.quantity_used || 0);
	const remaining = Math.max(0, allocated - used - reserved);

	return {
		subscriptionId: sub.id,
		cycleId: cycle.id,
		serviceId: Number(serviceId),
		serviceName: cycle.service_name,
		allocated,
		used,
		reserved,
		remaining,
		planName: sub.plan_snapshot?.planName || '',
	};
}

export async function reservePlanBenefit(
	supabase: any,
	clientId: string,
	serviceId: number,
	bookingId: string,
) {
	const availability = await getBenefitAvailability(supabase, clientId, serviceId);
	if (!availability || availability.remaining < 1) {
		throw Object.assign(new Error('Benefício do plano indisponível para este serviço no período atual'), {
			code: 'PLAN_BENEFIT_UNAVAILABLE',
		});
	}

	const { data, error } = await supabase
		.from('subscription_benefit_usage')
		.insert({
			cycle_id: availability.cycleId,
			booking_id: bookingId,
			service_id: serviceId,
			quantity: 1,
			status: 'reserved',
		})
		.select('id')
		.single();
	if (error) throw error;
	return { usageId: data.id as string, availability };
}

export async function consumePlanBenefitForBooking(supabase: any, bookingId: string) {
	const { data: usages, error } = await supabase
		.from('subscription_benefit_usage')
		.select('id, cycle_id, quantity, status')
		.eq('booking_id', bookingId)
		.eq('status', 'reserved');
	if (error) throw error;

	for (const usage of usages || []) {
		await supabase
			.from('subscription_benefit_usage')
			.update({ status: 'consumed', updated_at: new Date().toISOString() })
			.eq('id', usage.id);

		const { data: cycle } = await supabase
			.from('subscription_benefit_cycles')
			.select('quantity_used')
			.eq('id', usage.cycle_id)
			.single();
		if (cycle) {
			await supabase
				.from('subscription_benefit_cycles')
				.update({ quantity_used: Number(cycle.quantity_used || 0) + Number(usage.quantity || 1) })
				.eq('id', usage.cycle_id);
		}
	}
}

export async function releasePlanBenefitForBooking(supabase: any, bookingId: string) {
	const { data: usages, error } = await supabase
		.from('subscription_benefit_usage')
		.select('id, cycle_id, quantity, status')
		.eq('booking_id', bookingId)
		.in('status', ['reserved', 'consumed']);
	if (error) throw error;

	for (const usage of usages || []) {
		await supabase
			.from('subscription_benefit_usage')
			.update({ status: 'released', updated_at: new Date().toISOString() })
			.eq('id', usage.id);

		if (usage.status === 'consumed') {
			const { data: cycle } = await supabase
				.from('subscription_benefit_cycles')
				.select('quantity_used')
				.eq('id', usage.cycle_id)
				.single();
			if (cycle) {
				await supabase
					.from('subscription_benefit_cycles')
					.update({
						quantity_used: Math.max(0, Number(cycle.quantity_used || 0) - Number(usage.quantity || 1)),
					})
					.eq('id', usage.cycle_id);
			}
		}
	}
}
