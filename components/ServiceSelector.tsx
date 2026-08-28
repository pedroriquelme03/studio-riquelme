
import React, { useState, useEffect, useMemo } from 'react';
import { Service, BookingCartItem } from '../types';
import { formatServicePriceLabel } from '../lib/priceVariations';
import { CheckCircleIcon, PlusCircleIcon, ClockIcon, DollarSignIcon, UserIcon } from './icons';
import BookingCartPanel from './BookingCartPanel';
import MonthlyPlansPromoCard from './MonthlyPlansPromoCard';

interface Professional {
  id: string;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
}

interface ServiceSelectorProps {
  services: Service[];
  selectedService: Service | null;
  onSelectService: (service: Service | null) => void;
  selectedProfessionalId: string | null;
  onProfessionalChange: (professionalId: string | null) => void;
  onNext: () => void;
  cartItems: BookingCartItem[];
  onRemoveCartItem: (id: string) => void;
  cartTotalPrice: number;
  onFinalizeCart?: () => void;
  usePlanBenefit?: boolean;
  onUsePlanBenefitChange?: (value: boolean) => void;
}

const ServiceItem: React.FC<{ service: Service; isSelected: boolean; onToggle: () => void; }> = ({ service, isSelected, onToggle }) => (
    <div
      onClick={onToggle}
      className={`bg-surface-raised p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer hover:border-gold shadow-sm ${
        isSelected ? 'border-gold shadow-lg shadow-gold' : 'border-line'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-white">{service.name}</h3>
          <p className="text-zinc-300 text-sm mt-1">{service.description}</p>
          <p className="text-zinc-200 text-sm mt-1">
            {service.responsibleProfessionalName ? `Profissional: ${service.responsibleProfessionalName}` : 'Profissional: —'}
          </p>
          <div className="flex items-center space-x-4 mt-3 text-zinc-200 text-sm">
            <span className="flex items-center"><ClockIcon className="w-4 h-4 mr-1.5 text-gold" /> {service.duration} min</span>
            <span className="flex items-center"><DollarSignIcon className="w-4 h-4 mr-1.5 text-gold" /> {formatServicePriceLabel(service)}</span>
          </div>
        </div>
        {isSelected ? (
          <CheckCircleIcon className="w-7 h-7 text-gold flex-shrink-0 ml-4" />
        ) : (
          <PlusCircleIcon className="w-7 h-7 text-zinc-400 flex-shrink-0 ml-4" />
        )}
      </div>
    </div>
);


const BookingSummary: React.FC<{
  selectedService: Service | null;
  cartTotalPrice: number;
  onNext: () => void;
  canProceed: boolean;
}> = ({ selectedService, cartTotalPrice, onNext, canProceed }) => (
    <div className="sticky top-24 bg-surface-raised p-6 rounded-lg border border-line shadow-xl">
        <h2 className="text-xl font-bold text-white border-b border-line pb-3 mb-4">Item atual</h2>
        {!selectedService ? (
          <p className="text-zinc-300">Selecione um serviço para continuar.</p>
        ) : (
          <div className="space-y-2 mb-4 text-zinc-200">
            <p className="font-medium text-white">{selectedService.name}</p>
            <p className="text-sm">{selectedService.duration} min · {formatServicePriceLabel(selectedService)}</p>
          </div>
        )}
        {cartTotalPrice > 0 && (
          <div className="border-t border-line pt-3 mb-4 text-sm text-zinc-400">
            Carrinho: <span className="text-gold font-semibold">R$ {cartTotalPrice.toFixed(2)}</span>
          </div>
        )}
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="w-full bg-gold text-white font-bold py-3 px-4 rounded-lg mt-2 transition-all duration-300 hover:bg-gold disabled:bg-surface-muted disabled:cursor-not-allowed disabled:text-zinc-400 shadow-md"
        >
          Escolher data e hora
        </button>
    </div>
);

const FixedFooter: React.FC<{
  selectedService: Service | null;
  cartTotalPrice: number;
  onNext: () => void;
  isVisible: boolean;
  canProceed: boolean;
}> = ({ selectedService, cartTotalPrice, onNext, isVisible, canProceed }) => {
  if (!selectedService && cartTotalPrice <= 0) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-surface-raised border-t border-line shadow-lg z-40 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-zinc-300">
              {selectedService ? selectedService.name : 'Selecione um serviço'}
              {cartTotalPrice > 0 && ` · Carrinho R$ ${cartTotalPrice.toFixed(2)}`}
            </div>
            {selectedService && (
              <div className="text-lg font-bold text-gold">{formatServicePriceLabel(selectedService)}</div>
            )}
          </div>
          <button
            onClick={onNext}
            disabled={!canProceed}
            className="bg-gold hover:bg-gold text-white font-bold py-2.5 px-6 rounded-lg transition-all duration-300 shadow-md whitespace-nowrap disabled:opacity-50"
          >
            Próximo
          </button>
        </div>
      </div>
    </div>
  );
};

const ServiceSelector: React.FC<ServiceSelectorProps> = ({
  services,
  selectedService,
  onSelectService,
  selectedProfessionalId,
  onProfessionalChange,
  onNext,
  cartItems,
  onRemoveCartItem,
  cartTotalPrice,
  onFinalizeCart,
  usePlanBenefit = false,
  onUsePlanBenefitChange,
}) => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [serviceSearchQuery, setServiceSearchQuery] = useState<string>('');
  const [loadingProfessionals, setLoadingProfessionals] = useState<boolean>(false);
  const [showFixedFooter, setShowFixedFooter] = useState<boolean>(true);
  const [planBenefit, setPlanBenefit] = useState<{
    available: boolean;
    remaining: number;
    planName?: string;
    requiresAuth?: boolean;
  } | null>(null);
  const [hasMonthlyPlans, setHasMonthlyPlans] = useState(false);

  // Buscar profissionais ao carregar
  useEffect(() => {
    const fetchProfessionals = async () => {
      setLoadingProfessionals(true);
      try {
        const res = await fetch('/api/professionals');
        const data = await res.json();
        if (res.ok && data.professionals) {
          // Filtrar apenas profissionais ativos
          const activeProfessionals = data.professionals.filter((p: Professional) => p.is_active);
          setProfessionals(activeProfessionals);
        }
      } catch (error) {
        console.error('Erro ao carregar profissionais:', error);
      } finally {
        setLoadingProfessionals(false);
      }
    };
    fetchProfessionals();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/services?monthly_plans=1');
        const data = await res.json().catch(() => null);
        if (res.ok && Array.isArray(data?.plans)) {
          setHasMonthlyPlans(data.plans.length > 0);
        }
      } catch {
        setHasMonthlyPlans(false);
      }
    })();
  }, []);

  // Filtrar serviços por profissional e termo de busca
  const filteredServices = useMemo(() => {
    let result = selectedProfessionalId
      ? services.filter(service => service.responsibleProfessionalId === selectedProfessionalId)
      : services;

    const query = serviceSearchQuery.trim().toLowerCase();
    if (!query) return result;

    return result.filter(service => {
      const name = service.name.toLowerCase();
      const description = (service.description || '').toLowerCase();
      const professional = (service.responsibleProfessionalName || '').toLowerCase();
      return name.includes(query) || description.includes(query) || professional.includes(query);
    });
  }, [services, selectedProfessionalId, serviceSearchQuery]);

  // Limpar serviço selecionado se não pertencer ao profissional filtrado
  useEffect(() => {
    if (selectedProfessionalId && selectedService
      && selectedService.responsibleProfessionalId
      && selectedService.responsibleProfessionalId !== selectedProfessionalId) {
      onSelectService(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfessionalId]);

  useEffect(() => {
    onUsePlanBenefitChange?.(false);
    if (!selectedService) {
      setPlanBenefit(null);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/client-auth?plan_benefit=1&service_id=${selectedService.id}`, {
          credentials: 'same-origin',
        });
        const data = await res.json();
        if (res.ok) {
          setPlanBenefit({
            available: Boolean(data.available),
            remaining: Number(data.remaining || 0),
            planName: data.planName,
            requiresAuth: Boolean(data.requiresAuth),
          });
        } else {
          setPlanBenefit(null);
        }
      } catch {
        setPlanBenefit(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedService?.id]);

  const toggleService = (service: Service) => {
    if (selectedService?.id === service.id) {
      onSelectService(null);
    } else {
      onSelectService(service);
    }
  };

  const handleProfessionalChange = (professionalId: string) => {
    onProfessionalChange(professionalId === '' ? null : professionalId);
    onSelectService(null);
  };

  const selectedProfessional = professionals.find(p => p.id === selectedProfessionalId);

  const canProceed = !!selectedService && (
    !!selectedService.responsibleProfessionalId || !!selectedProfessionalId
  );

  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const isNearBottom = scrollTop + windowHeight >= documentHeight - 100;
      setShowFixedFooter(!isNearBottom);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="space-y-6 pb-20">
      <BookingCartPanel items={cartItems} onRemove={onRemoveCartItem} onFinalize={onFinalizeCart} />

      {hasMonthlyPlans && <MonthlyPlansPromoCard />}

      {selectedService && planBenefit?.available && (
        <div className="bg-green-500/10 border border-green-500/40 rounded-lg p-4 text-sm text-green-100">
          <p className="font-semibold text-green-200">Incluso no seu plano</p>
          <p className="mt-1">
            Você ainda possui {planBenefit.remaining} utilização{planBenefit.remaining === 1 ? '' : 'ões'} disponível{planBenefit.remaining === 1 ? '' : 'is'} neste mês para {selectedService.name}.
          </p>
          <label className="mt-3 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={usePlanBenefit}
              onChange={(e) => onUsePlanBenefitChange?.(e.target.checked)}
            />
            <span>Usar benefício do plano neste agendamento (sem cobrança adicional)</span>
          </label>
        </div>
      )}

      {/* Seletor de Profissional */}
      <div className="bg-surface-raised p-4 rounded-lg border border-line shadow-sm">
        <label htmlFor="professional-select" className="block text-sm font-medium text-zinc-200 mb-2">
          <UserIcon className="w-5 h-5 inline mr-2 text-gold" />
          Selecionar Profissional
        </label>
        <select
          id="professional-select"
          value={selectedProfessionalId || ''}
          onChange={(e) => handleProfessionalChange(e.target.value)}
          className="w-full bg-surface-overlay border border-line rounded-lg p-3 text-white focus:ring-gold focus:border-gold"
          disabled={loadingProfessionals}
        >
          <option value="">Todos os profissionais</option>
          {professionals.map(professional => (
            <option key={professional.id} value={professional.id}>
              {professional.name}
            </option>
          ))}
        </select>
        {selectedProfessional && (
          <p className="mt-2 text-sm text-zinc-300">
            Mostrando serviços de: <span className="font-semibold text-gold">{selectedProfessional.name}</span>
          </p>
        )}
      </div>

      {/* Pesquisa de serviços */}
      <div className="bg-surface-raised p-4 rounded-lg border border-line shadow-sm">
        <label htmlFor="service-search" className="block text-sm font-medium text-zinc-200 mb-2">
          Pesquisar Serviços
        </label>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="service-search"
            type="search"
            value={serviceSearchQuery}
            onChange={(e) => setServiceSearchQuery(e.target.value)}
            placeholder="Buscar por nome, descrição ou profissional..."
            className="w-full bg-surface-overlay border border-line rounded-lg py-3 pl-10 pr-10 text-white focus:ring-gold focus:border-gold"
          />
          {serviceSearchQuery && (
            <button
              type="button"
              onClick={() => setServiceSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300"
              aria-label="Limpar pesquisa"
            >
              ×
            </button>
          )}
        </div>
        {serviceSearchQuery.trim() && (
          <p className="mt-2 text-sm text-zinc-300">
            {filteredServices.length === 0
              ? 'Nenhum serviço encontrado.'
              : `${filteredServices.length} serviço${filteredServices.length === 1 ? '' : 's'} encontrado${filteredServices.length === 1 ? '' : 's'}.`}
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-2xl font-bold gold-text mb-2">Nossos Serviços</h2>
          {filteredServices.length === 0 ? (
            <div className="bg-surface-overlay border border-line rounded-lg p-8 text-center">
              <p className="text-zinc-300">
                {serviceSearchQuery.trim()
                  ? 'Nenhum serviço encontrado para sua busca.'
                  : selectedProfessionalId
                    ? 'Nenhum serviço disponível para este profissional.'
                    : 'Nenhum serviço disponível no momento.'}
              </p>
            </div>
          ) : (
            filteredServices.map(service => (
              <ServiceItem 
                key={service.id}
                service={service}
                isSelected={selectedService?.id === service.id}
                onToggle={() => toggleService(service)}
              />
            ))
          )}
        </div>
        <div className="lg:col-span-1">
          <BookingSummary 
            selectedService={selectedService}
            cartTotalPrice={cartTotalPrice}
            onNext={onNext}
            canProceed={canProceed}
          />
        </div>
      </div>

      <FixedFooter
        selectedService={selectedService}
        cartTotalPrice={cartTotalPrice}
        onNext={onNext}
        isVisible={showFixedFooter && (!!selectedService || cartTotalPrice > 0)}
        canProceed={canProceed}
      />
    </div>
  );
};

export default ServiceSelector;
