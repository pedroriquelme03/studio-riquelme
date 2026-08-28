import type { Service, ServicePriceSelection } from '../types';

export const PRICE_VARIATION_HAIR_SIZE = 'hair_size' as const;

export const HAIR_SIZE_VARIANT_DEFS = [
	{ key: 'small', label: 'Pequeno', sortOrder: 1 },
	{ key: 'medium', label: 'Médio', sortOrder: 2 },
	{ key: 'large', label: 'Grande', sortOrder: 3 },
] as const;

export const HAIR_SIZE_DISCLAIMER =
	'O tamanho do cabelo selecionado está sujeito à avaliação do profissional no momento do atendimento, podendo haver alteração no valor do serviço conforme a avaliação realizada.';

export function serviceRequiresHairSize(service: Service | null | undefined): boolean {
	return Boolean(
		service?.priceVariationEnabled
		&& service.priceVariationType === PRICE_VARIATION_HAIR_SIZE
		&& (service.priceVariants?.length ?? 0) > 0,
	);
}

export function getVariantPrice(service: Service, variantKey: string): number | null {
	const variant = service.priceVariants?.find((v) => v.variantKey === variantKey);
	return variant ? variant.price : null;
}

export function applyPriceSelection(service: Service, selection: ServicePriceSelection): Service {
	return { ...service, price: selection.price };
}

export function formatServicePriceLabel(service: Service): string {
	if (!service.priceVariationEnabled || !service.priceVariants?.length) {
		return `R$ ${service.price.toFixed(2)}`;
	}
	const prices = service.priceVariants.map((v) => v.price);
	const min = Math.min(...prices);
	const max = Math.max(...prices);
	if (min === max) return `R$ ${min.toFixed(2)}`;
	return `R$ ${min.toFixed(2)} – R$ ${max.toFixed(2)}`;
}
