export const PRICE_VARIATION_HAIR_SIZE = 'hair_size' as const;

export type PriceVariationType = typeof PRICE_VARIATION_HAIR_SIZE;

export const HAIR_SIZE_VARIANT_DEFS = [
	{ key: 'small', label: 'Pequeno', sortOrder: 1 },
	{ key: 'medium', label: 'Médio', sortOrder: 2 },
	{ key: 'large', label: 'Grande', sortOrder: 3 },
] as const;

export function isMissingVariationSchemaError(message: string): boolean {
	return /service_price_variants|price_variation_enabled|price_variation_type/i.test(message);
}

export function mapVariantRows(rows: any[] | null | undefined) {
	return (rows || [])
		.map((r) => ({
			variationType: String(r.variation_type) as PriceVariationType,
			variantKey: String(r.variant_key),
			label: String(r.label),
			price: Number(r.price),
			sortOrder: Number(r.sort_order ?? 0),
		}))
		.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function loadVariantsByServiceIds(supabase: any, serviceIds: number[]) {
	const map = new Map<number, ReturnType<typeof mapVariantRows>>();
	if (!serviceIds.length) return map;

	const { data, error } = await supabase
		.from('service_price_variants')
		.select('service_id, variation_type, variant_key, label, price, sort_order')
		.in('service_id', serviceIds);

	if (error) {
		if (isMissingVariationSchemaError(error.message)) return map;
		throw error;
	}

	for (const row of data || []) {
		const serviceId = Number(row.service_id);
		const list = map.get(serviceId) || [];
		list.push(row);
		map.set(serviceId, list);
	}

	for (const [serviceId, rows] of map.entries()) {
		map.set(serviceId, mapVariantRows(rows));
	}
	return map;
}

export async function resolveBookingServicePrice(
	supabase: any,
	serviceId: number,
	variationType?: string | null,
	variantKey?: string | null,
): Promise<{
	unitPrice: number;
	variationType: string | null;
	variantKey: string | null;
	variantLabel: string | null;
}> {
	const { data: svc, error } = await supabase
		.from('services')
		.select('price, price_variation_enabled, price_variation_type')
		.eq('id', serviceId)
		.single();

	if (error || !svc) {
		throw Object.assign(new Error(`Serviço ${serviceId} não encontrado`), { code: 'SERVICE_NOT_FOUND' });
	}

	if (!svc.price_variation_enabled) {
		return {
			unitPrice: Number(svc.price),
			variationType: null,
			variantKey: null,
			variantLabel: null,
		};
	}

	const resolvedType = variationType || svc.price_variation_type;
	if (!resolvedType || !variantKey) {
		throw Object.assign(
			new Error('Selecione o tamanho do cabelo para este serviço'),
			{ code: 'VARIATION_REQUIRED' },
		);
	}

	const { data: variant, error: variantErr } = await supabase
		.from('service_price_variants')
		.select('price, label')
		.eq('service_id', serviceId)
		.eq('variation_type', resolvedType)
		.eq('variant_key', variantKey)
		.maybeSingle();

	if (variantErr) throw variantErr;
	if (!variant) {
		throw Object.assign(new Error('Variação de preço inválida'), { code: 'INVALID_VARIANT' });
	}

	return {
		unitPrice: Number(variant.price),
		variationType: resolvedType,
		variantKey,
		variantLabel: String(variant.label),
	};
}

export async function upsertServicePriceVariants(
	supabase: any,
	serviceId: number,
	enabled: boolean,
	variationType: string | null,
	variants: Array<{ variantKey: string; label: string; price: number; sortOrder: number }>,
) {
	const { error: svcErr } = await supabase
		.from('services')
		.update({
			price_variation_enabled: enabled,
			price_variation_type: enabled ? variationType : null,
		})
		.eq('id', serviceId);
	if (svcErr) throw svcErr;

	const { error: delErr } = await supabase
		.from('service_price_variants')
		.delete()
		.eq('service_id', serviceId);
	if (delErr && !isMissingVariationSchemaError(delErr.message)) throw delErr;

	if (!enabled || !variants.length) return;

	const rows = variants.map((v) => ({
		service_id: serviceId,
		variation_type: variationType,
		variant_key: v.variantKey,
		label: v.label,
		price: v.price,
		sort_order: v.sortOrder,
	}));
	const { error: insErr } = await supabase.from('service_price_variants').insert(rows);
	if (insErr) throw insErr;
}
