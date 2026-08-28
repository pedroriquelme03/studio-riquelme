import { syncAbacatePayProduct } from './abacatepay.js';
import { isMissingMonthlyPlansError, loadPlanServicesMap, mapPlanRow } from './monthly-plans.js';

function parseBenefits(raw: unknown): string[] {
	if (Array.isArray(raw)) return raw.map((b) => String(b).trim()).filter(Boolean);
	if (typeof raw === 'string') {
		return raw.split('\n').map((l) => l.trim()).filter(Boolean);
	}
	return [];
}

function parsePlanServices(raw: unknown) {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((s: any, idx: number) => ({
			service_id: Number(s.serviceId ?? s.service_id),
			quantity_per_month: Number(s.quantityPerMonth ?? s.quantity_per_month),
			sort_order: Number(s.sortOrder ?? s.sort_order ?? idx),
		}))
		.filter((s) => Number.isFinite(s.service_id) && s.quantity_per_month > 0);
}

export async function handleMonthlyPlansGet(supabase: any, isAdmin: boolean) {
	let query = supabase
		.from('monthly_plans')
		.select('*')
		.order('display_order', { ascending: true })
		.order('name', { ascending: true });
	if (!isAdmin) query = query.eq('is_active', true);

	const { data, error } = await query;
	if (error) {
		if (isMissingMonthlyPlansError(error.message)) return { ok: true, plans: [] };
		throw error;
	}

	const planIds = (data || []).map((p: any) => String(p.id));
	const servicesMap = await loadPlanServicesMap(supabase, planIds).catch(() => new Map());
	const plans = (data || []).map((row: any) => mapPlanRow(row, servicesMap.get(String(row.id)) || []));
	return { ok: true, plans };
}

export async function handleMonthlyPlanSave(supabase: any, body: any, isUpdate: boolean) {
	const id = body?.id ? String(body.id) : null;
	const name = String(body?.name || '').trim();
	const description = String(body?.description || '').trim();
	const monthlyPrice = Number(body?.monthlyPrice ?? body?.monthly_price);
	const imageUrl = body?.imageUrl ?? body?.image_url ?? null;
	const benefits = parseBenefits(body?.benefits);
	const rulesNotes = String(body?.rulesNotes ?? body?.rules_notes ?? '').trim();
	const displayOrder = Number(body?.displayOrder ?? body?.display_order ?? 0);
	const isFeatured = Boolean(body?.isFeatured ?? body?.is_featured);
	const isActive = body?.isActive !== false && body?.is_active !== false;
	const services = parsePlanServices(body?.services);

	if (!name || !Number.isFinite(monthlyPrice) || monthlyPrice <= 0) {
		throw Object.assign(new Error('name e monthlyPrice válidos são obrigatórios'), { status: 400 });
	}

	const row = {
		name,
		description,
		monthly_price: monthlyPrice,
		image_url: imageUrl || null,
		benefits,
		rules_notes: rulesNotes,
		display_order: displayOrder,
		is_featured: isFeatured,
		is_active: isActive,
		updated_at: new Date().toISOString(),
	};

	let planId = id;
	if (isUpdate && id) {
		const { error } = await supabase.from('monthly_plans').update(row).eq('id', id);
		if (error) throw error;
	} else {
		const { data, error } = await supabase.from('monthly_plans').insert(row).select('id, abacatepay_product_id').single();
		if (error) throw error;
		planId = String(data.id);
	}

	await supabase.from('monthly_plan_services').delete().eq('plan_id', planId);
	if (services.length) {
		const { error: svcErr } = await supabase.from('monthly_plan_services').insert(
			services.map((s) => ({ ...s, plan_id: planId })),
		);
		if (svcErr) throw svcErr;
	}

	const { data: current } = await supabase
		.from('monthly_plans')
		.select('id, name, description, monthly_price, image_url, abacatepay_product_id')
		.eq('id', planId)
		.single();

	if (process.env.ABACATEPAY_API_KEY) {
		try {
			const productId = await syncAbacatePayProduct({
				id: String(current.id),
				name: current.name,
				description: current.description,
				monthlyPrice: Number(current.monthly_price),
				imageUrl: current.image_url,
				abacatepayProductId: current.abacatepay_product_id,
			});
			await supabase.from('monthly_plans').update({ abacatepay_product_id: productId }).eq('id', planId);
		} catch (e) {
			console.error('[monthly-plans] Falha ao sincronizar produto AbacatePay:', e);
		}
	}

	return { ok: true, id: planId };
}

export async function handleMonthlyPlanDelete(supabase: any, planId: string) {
	const { error } = await supabase.from('monthly_plans').delete().eq('id', planId);
	if (error) throw error;
	return { ok: true };
}
