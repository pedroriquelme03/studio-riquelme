import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireAdmin, getSession } from './_lib/session.js';
import {
	isMissingTableError,
	normalizeKind,
	validatePromotionItemsPercent,
	type PromotionItemRow,
} from './_lib/promotions.js';
import {
	loadVariantsByServiceIds,
	upsertServicePriceVariants,
	PRICE_VARIATION_HAIR_SIZE,
	HAIR_SIZE_VARIANT_DEFS,
} from './_lib/price-variations.js';
import {
	handleMonthlyPlansGet,
	handleMonthlyPlanSave,
	handleMonthlyPlanDelete,
} from './_lib/monthly-plans-api.js';

function mapServiceRow(r: any, variants: any[] = []) {
	return {
		id: r.id,
		name: r.name,
		price: Number(r.price),
		duration: Number(r.duration_minutes),
		description: r.description || '',
		responsibleProfessionalId: r.responsible_professional_id,
		responsibleProfessionalName: r.professionals?.name || null,
		priceVariationEnabled: Boolean(r.price_variation_enabled),
		priceVariationType: r.price_variation_type || null,
		priceVariants: variants,
	};
}

function parsePriceVariantsInput(body: any) {
	const enabled = Boolean(body?.priceVariationEnabled ?? body?.price_variation_enabled);
	const variationType = body?.priceVariationType ?? body?.price_variation_type ?? PRICE_VARIATION_HAIR_SIZE;
	const rawVariants = body?.priceVariants ?? body?.price_variants;

	if (!enabled) {
		return { enabled: false, variationType: null, variants: [] as Array<{ variantKey: string; label: string; price: number; sortOrder: number }> };
	}

	if (variationType !== PRICE_VARIATION_HAIR_SIZE) {
		throw new Error('Tipo de variação não suportado');
	}

	const pricesByKey: Record<string, number> = {};
	if (Array.isArray(rawVariants)) {
		for (const v of rawVariants) {
			const key = String(v.variantKey ?? v.variant_key ?? '');
			const price = Number(v.price);
			if (key) pricesByKey[key] = price;
		}
	} else if (rawVariants && typeof rawVariants === 'object') {
		for (const def of HAIR_SIZE_VARIANT_DEFS) {
			const price = Number((rawVariants as any)[def.key]);
			if (Number.isFinite(price)) pricesByKey[def.key] = price;
		}
	}

	const variants = HAIR_SIZE_VARIANT_DEFS.map((def) => ({
		variantKey: def.key,
		label: def.label,
		price: pricesByKey[def.key],
		sortOrder: def.sortOrder,
	}));

	const missing = variants.filter((v) => !Number.isFinite(v.price) || v.price <= 0);
	if (missing.length) {
		throw new Error('Informe preços válidos para Pequeno, Médio e Grande');
	}

	return { enabled: true, variationType, variants };
}

function mapPromotionRow(row: any) {
	const items = (row.items || [])
		.map((item: any) => ({
			serviceId: Number(item.service_id),
			professionalId: String(item.professional_id),
			sortOrder: Number(item.sort_order),
			pricePercent: Number(item.price_percent),
			serviceName: Array.isArray(item.services) ? item.services[0]?.name : item.services?.name,
			serviceDuration: Number(Array.isArray(item.services) ? item.services[0]?.duration_minutes : item.services?.duration_minutes) || 30,
			professionalName: item.professionals?.name || null,
		}))
		.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
	return {
		id: row.id,
		name: row.name,
		description: row.description || '',
		kind: row.kind,
		totalPrice: Number(row.total_price),
		validFrom: row.valid_from ? String(row.valid_from).slice(0, 10) : null,
		validUntil: row.valid_until ? String(row.valid_until).slice(0, 10) : null,
		gapMinutes: Number(row.gap_minutes || 0),
		isActive: row.is_active !== false,
		items,
	};
}

export default async function handler(req: any, res: any) {
	try {
		// GET é público (o fluxo de agendamento lista os serviços).
		// Qualquer escrita exige sessão de admin.
		if (req.method !== 'GET' && !requireAdmin(req, res)) return;
		const isAdmin = getSession(req, 'admin')?.role === 'admin';

		const supabaseUrl =
			process.env.SUPABASE_URL ||
			process.env.VITE_SUPABASE_URL;
		const supabaseKey =
			process.env.SUPABASE_SERVICE_ROLE_KEY ||
			process.env.VITE_SUPABASE_ANON_KEY;
		if (!supabaseUrl || !supabaseKey) {
			return res.status(500).json({ ok: false, error: 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados' });
		}
		const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

		if (req.method === 'GET') {
			const urlObj = new URL(req?.url || '/', 'http://localhost');

			if (urlObj.searchParams.get('monthly_plans') === '1') {
				try {
					const result = await handleMonthlyPlansGet(supabase, isAdmin);
					return res.status(200).json(result);
				} catch (e: any) {
					return res.status(e?.status || 500).json({ ok: false, error: e?.message || 'Erro ao carregar planos' });
				}
			}

			if (urlObj.searchParams.get('promotions') === '1') {
				let query = supabase
					.from('promotions')
					.select(`
						id, name, description, kind, total_price, valid_from, valid_until, gap_minutes, is_active,
						items:promotion_items (
							id, promotion_id, service_id, professional_id, sort_order, price_percent,
							services:service_id ( id, name, duration_minutes, price ),
							professionals:professional_id ( id, name )
						)
					`)
					.order('name', { ascending: true });
				if (!isAdmin) query = query.eq('is_active', true);
				const { data, error } = await query;
				if (error) {
					if (isMissingTableError(error.message)) {
						return res.status(200).json({ ok: true, promotions: [] });
					}
					return res.status(500).json({ ok: false, error: error.message });
				}
				const today = new Date().toISOString().slice(0, 10);
				const promotions = (data || [])
					.map(mapPromotionRow)
					.filter((p: any) => {
						if (isAdmin) return true;
						if (!p.isActive) return false;
						if (p.kind === 'fixed') return true;
						if (p.validFrom && today < p.validFrom) return false;
						if (p.validUntil && today > p.validUntil) return false;
						return true;
					});
				return res.status(200).json({ ok: true, promotions });
			}

			const { data, error } = await supabase
				.from('services')
				.select(`
          id,
          name,
          price,
          duration_minutes,
          description,
          responsible_professional_id,
          price_variation_enabled,
          price_variation_type,
          professionals:responsible_professional_id ( id, name )
        `)
				.order('name', { ascending: true });
			if (error) return res.status(500).json({ ok: false, error: error.message });

			const serviceIds = (data || []).map((r: any) => Number(r.id));
			let variantsMap = new Map<number, any[]>();
			try {
				variantsMap = await loadVariantsByServiceIds(supabase, serviceIds);
			} catch {
				variantsMap = new Map();
			}

			const services = (data || []).map((r: any) => mapServiceRow(r, variantsMap.get(Number(r.id)) || []));
			return res.status(200).json({ ok: true, services });
		}

		if (req.method === 'POST') {
			const raw = req.body ?? {};
			const body = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;

			if (body?.type === 'monthly_plan') {
				try {
					const result = await handleMonthlyPlanSave(supabase, body, false);
					return res.status(201).json(result);
				} catch (e: any) {
					return res.status(e?.status || 500).json({ ok: false, error: e?.message || 'Erro ao criar plano' });
				}
			}

			if (body?.type === 'promotion') {
				const name = String(body?.name || '').trim();
				const description = String(body?.description || '').trim();
				const kind = normalizeKind(body?.kind);
				const total_price = Number(body?.totalPrice ?? body?.total_price);
				const valid_from = body?.validFrom || body?.valid_from || null;
				const valid_until = body?.validUntil || body?.valid_until || null;
				const gap_minutes = Number(body?.gapMinutes ?? body?.gap_minutes ?? 0);
				const is_active = body?.isActive !== false && body?.is_active !== false;
				const items = (body?.items || []) as PromotionItemRow[];

				if (!name) return res.status(400).json({ ok: false, error: 'name é obrigatório' });
				if (!Number.isFinite(total_price) || total_price <= 0) {
					return res.status(400).json({ ok: false, error: 'totalPrice deve ser maior que zero' });
				}
				const percentErr = validatePromotionItemsPercent(items);
				if (percentErr) return res.status(400).json({ ok: false, error: percentErr });

				const { data: promo, error: promoErr } = await supabase
					.from('promotions')
					.insert({
						name,
						description: description || null,
						kind,
						total_price,
						valid_from: kind === 'temporary' ? valid_from : null,
						valid_until: kind === 'temporary' ? valid_until : null,
						gap_minutes: Math.max(0, gap_minutes),
						is_active,
					})
					.select('id')
					.single();
				if (promoErr) return res.status(500).json({ ok: false, error: promoErr.message });

				const rows = items.map((item) => ({
					promotion_id: promo.id,
					service_id: Number(item.service_id),
					professional_id: String(item.professional_id),
					sort_order: Number(item.sort_order),
					price_percent: Number(item.price_percent),
				}));
				const { error: itemsErr } = await supabase.from('promotion_items').insert(rows);
				if (itemsErr) {
					await supabase.from('promotions').delete().eq('id', promo.id);
					return res.status(500).json({ ok: false, error: itemsErr.message });
				}
				return res.status(201).json({ ok: true, id: promo.id });
			}

			const { name, price, duration, description, responsibleProfessionalId } = body as {
				name?: string; price?: number; duration?: number; description?: string; responsibleProfessionalId?: string | null;
			};
			if (!name || !price || !duration) {
				return res.status(400).json({ ok: false, error: 'name, price e duration são obrigatórios' });
			}

			let variationConfig;
			try {
				variationConfig = parsePriceVariantsInput(body);
			} catch (e: any) {
				return res.status(400).json({ ok: false, error: e?.message || 'Configuração de variação inválida' });
			}

			const { data, error } = await supabase
				.from('services')
				.insert({
					name,
					price,
					duration_minutes: duration,
					description: description || '',
					responsible_professional_id: responsibleProfessionalId ?? null,
					price_variation_enabled: variationConfig.enabled,
					price_variation_type: variationConfig.enabled ? variationConfig.variationType : null,
				})
				.select('id')
				.single();
			if (error) return res.status(500).json({ ok: false, error: error.message });

			try {
				await upsertServicePriceVariants(
					supabase,
					Number(data?.id),
					variationConfig.enabled,
					variationConfig.variationType,
					variationConfig.variants,
				);
			} catch (e: any) {
				await supabase.from('services').delete().eq('id', data?.id);
				return res.status(500).json({ ok: false, error: e?.message || 'Erro ao salvar variações de preço' });
			}
			return res.status(201).json({ ok: true, id: data?.id });
		}

		if (req.method === 'PUT') {
			const raw = req.body ?? {};
			const body = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;

			if (body?.type === 'monthly_plan') {
				try {
					const result = await handleMonthlyPlanSave(supabase, body, true);
					return res.status(200).json(result);
				} catch (e: any) {
					return res.status(e?.status || 500).json({ ok: false, error: e?.message || 'Erro ao atualizar plano' });
				}
			}

			if (body?.type === 'promotion') {
				const id = String(body?.id || '');
				const name = String(body?.name || '').trim();
				const description = String(body?.description || '').trim();
				const kind = normalizeKind(body?.kind);
				const total_price = Number(body?.totalPrice ?? body?.total_price);
				const valid_from = body?.validFrom || body?.valid_from || null;
				const valid_until = body?.validUntil || body?.valid_until || null;
				const gap_minutes = Number(body?.gapMinutes ?? body?.gap_minutes ?? 0);
				const is_active = body?.isActive !== false && body?.is_active !== false;
				const items = (body?.items || []) as PromotionItemRow[];

				if (!id || !name) return res.status(400).json({ ok: false, error: 'id e name são obrigatórios' });
				if (!Number.isFinite(total_price) || total_price <= 0) {
					return res.status(400).json({ ok: false, error: 'totalPrice deve ser maior que zero' });
				}
				const percentErr = validatePromotionItemsPercent(items);
				if (percentErr) return res.status(400).json({ ok: false, error: percentErr });

				const { error: updErr } = await supabase
					.from('promotions')
					.update({
						name,
						description: description || null,
						kind,
						total_price,
						valid_from: kind === 'temporary' ? valid_from : null,
						valid_until: kind === 'temporary' ? valid_until : null,
						gap_minutes: Math.max(0, gap_minutes),
						is_active,
						updated_at: new Date().toISOString(),
					})
					.eq('id', id);
				if (updErr) return res.status(500).json({ ok: false, error: updErr.message });

				await supabase.from('promotion_items').delete().eq('promotion_id', id);
				const rows = items.map((item) => ({
					promotion_id: id,
					service_id: Number(item.service_id),
					professional_id: String(item.professional_id),
					sort_order: Number(item.sort_order),
					price_percent: Number(item.price_percent),
				}));
				const { error: itemsErr } = await supabase.from('promotion_items').insert(rows);
				if (itemsErr) return res.status(500).json({ ok: false, error: itemsErr.message });
				return res.status(200).json({ ok: true });
			}

			const { id, name, price, duration, description, responsibleProfessionalId } = body as {
				id?: number; name?: string; price?: number; duration?: number; description?: string; responsibleProfessionalId?: string | null;
			};
			if (!id || !name || !price || !duration) {
				return res.status(400).json({ ok: false, error: 'id, name, price e duration são obrigatórios' });
			}

			let variationConfig;
			try {
				variationConfig = parsePriceVariantsInput(body);
			} catch (e: any) {
				return res.status(400).json({ ok: false, error: e?.message || 'Configuração de variação inválida' });
			}

			const { error } = await supabase
				.from('services')
				.update({
					name,
					price,
					duration_minutes: duration,
					description: description || '',
					responsible_professional_id: responsibleProfessionalId ?? null,
					price_variation_enabled: variationConfig.enabled,
					price_variation_type: variationConfig.enabled ? variationConfig.variationType : null,
				})
				.eq('id', id);
			if (error) return res.status(500).json({ ok: false, error: error.message });

			try {
				await upsertServicePriceVariants(
					supabase,
					Number(id),
					variationConfig.enabled,
					variationConfig.variationType,
					variationConfig.variants,
				);
			} catch (e: any) {
				return res.status(500).json({ ok: false, error: e?.message || 'Erro ao salvar variações de preço' });
			}
			return res.status(200).json({ ok: true });
		}

		if (req.method === 'DELETE') {
			const urlObj = new URL(req?.url || '/', 'http://localhost');
			const planId = urlObj.searchParams.get('monthly_plan_id');
			if (planId) {
				try {
					const result = await handleMonthlyPlanDelete(supabase, planId);
					return res.status(200).json(result);
				} catch (e: any) {
					return res.status(500).json({ ok: false, error: e?.message || 'Erro ao excluir plano' });
				}
			}
			const promotionId = urlObj.searchParams.get('promotion_id');
			if (promotionId) {
				const { error } = await supabase.from('promotions').delete().eq('id', promotionId);
				if (error) return res.status(500).json({ ok: false, error: error.message });
				return res.status(200).json({ ok: true });
			}
			const id = Number(urlObj.searchParams.get('id') || '0');
			if (!id) return res.status(400).json({ ok: false, error: 'id é obrigatório' });
			const { error } = await supabase.from('services').delete().eq('id', id);
			if (error) return res.status(500).json({ ok: false, error: error.message });
			return res.status(200).json({ ok: true });
		}

		res.setHeader('Allow', 'GET, POST, PUT, DELETE');
		return res.status(405).json({ ok: false, error: 'Método não permitido' });
	} catch (err: any) {
		return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
	}
}

