export type PriceVariationType = 'hair_size';

export interface ServicePriceVariant {
  variationType: PriceVariationType;
  variantKey: string;
  label: string;
  price: number;
  sortOrder: number;
}

export interface ServicePriceSelection {
  variationType: PriceVariationType;
  variantKey: string;
  label: string;
  price: number;
}

export interface Service {
  id: number;
  name: string;
  price: number;
  duration: number; // in minutes
  description: string;
  // opcional: profissional responsável
  responsibleProfessionalId?: string | null;
  responsibleProfessionalName?: string | null;
  priceVariationEnabled?: boolean;
  priceVariationType?: PriceVariationType | null;
  priceVariants?: ServicePriceVariant[];
}

export interface PromotionItem {
  serviceId: number;
  professionalId: string;
  sortOrder: number;
  pricePercent: number;
  serviceName?: string;
  serviceDuration?: number;
  professionalName?: string;
}

export interface Promotion {
  id: string;
  name: string;
  description?: string;
  kind: 'fixed' | 'temporary';
  totalPrice: number;
  validFrom?: string | null;
  validUntil?: string | null;
  gapMinutes: number;
  isActive: boolean;
  items: PromotionItem[];
}

export interface BookingCartItem {
  id: string;
  service: Service;
  date: Date;
  time: string;
  professionalId: string | null;
  professionalName?: string | null;
  priceSelection?: ServicePriceSelection | null;
  usePlanBenefit?: boolean;
}

export interface MonthlyPlanService {
  serviceId: number;
  serviceName: string;
  quantityPerMonth: number;
  sortOrder?: number;
}

export interface MonthlyPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  imageUrl?: string | null;
  benefits: string[];
  rulesNotes?: string;
  displayOrder?: number;
  isFeatured?: boolean;
  isActive?: boolean;
  services: MonthlyPlanService[];
}

export interface Client {
  name: string;
  phone: string;
  email: string;
  notes?: string;
}

export interface Booking {
  services: Service[];
  date: Date;
  time: string;
  client: Client;
  promotion?: Promotion | null;
  bookingMode?: 'services' | 'promotion';
  cartItems?: BookingCartItem[];
}
