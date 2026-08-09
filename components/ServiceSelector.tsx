
import React, { useState, useEffect, useMemo } from 'react';
import { Service } from '../types';
import { CheckCircleIcon, PlusCircleIcon, ClockIcon, DollarSignIcon, UserIcon } from './icons';

interface Professional {
  id: string;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
}

interface ServiceSelectorProps {
  services: Service[];
  selectedServices: Service[];
  onSelectServices: (services: Service[]) => void;
  onNext: () => void;
  totalDuration: number;
  totalPrice: number;
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
            <span className="flex items-center"><DollarSignIcon className="w-4 h-4 mr-1.5 text-gold" /> R${service.price.toFixed(2)}</span>
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
  selectedServices: Service[];
  totalDuration: number;
  totalPrice: number;
  onNext: () => void;
}> = ({ selectedServices, totalDuration, totalPrice, onNext }) => (
    <div className="sticky top-24 bg-surface-raised p-6 rounded-lg border border-line shadow-xl">
        <h2 className="text-xl font-bold text-white border-b border-line pb-3 mb-4">Resumo do Agendamento</h2>
        {selectedServices.length === 0 ? (
          <p className="text-zinc-300">Selecione um serviço para começar.</p>
        ) : (
          <ul className="space-y-2 mb-4">
            {selectedServices.map(s => (
              <li key={s.id} className="flex justify-between text-zinc-200">
                <span>{s.name}</span>
                <span>R${s.price.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-line pt-4 mt-4 space-y-3">
          <div className="flex justify-between font-semibold text-white">
            <span>Tempo total:</span>
            <span>{totalDuration} min</span>
          </div>
          <div className="flex justify-between font-bold text-lg text-gold">
            <span>Valor total:</span>
            <span>R${totalPrice.toFixed(2)}</span>
          </div>
        </div>
        <button
          onClick={onNext}
          disabled={selectedServices.length === 0}
          className="w-full bg-gold text-white font-bold py-3 px-4 rounded-lg mt-6 transition-all duration-300 hover:bg-gold disabled:bg-surface-muted disabled:cursor-not-allowed disabled:text-zinc-400 shadow-md"
        >
          Próximo
        </button>
    </div>
);

// Rodapé fixo resumido
const FixedFooter: React.FC<{
  selectedServices: Service[];
  totalPrice: number;
  onNext: () => void;
  isVisible: boolean;
}> = ({ selectedServices, totalPrice, onNext, isVisible }) => {
  if (selectedServices.length === 0) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-surface-raised border-t border-line shadow-lg z-40 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <span className="font-medium">
                {selectedServices.length === 1 
                  ? selectedServices[0].name 
                  : `${selectedServices.length} serviços selecionados`}
              </span>
            </div>
            <div className="text-lg font-bold text-gold">
              R$ {totalPrice.toFixed(2)}
            </div>
          </div>
          <button
            onClick={onNext}
            className="bg-gold hover:bg-gold text-white font-bold py-2.5 px-6 rounded-lg transition-all duration-300 shadow-md whitespace-nowrap"
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
  selectedServices,
  onSelectServices,
  onNext,
  totalDuration,
  totalPrice
}) => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | null>(null);
  const [serviceSearchQuery, setServiceSearchQuery] = useState<string>('');
  const [loadingProfessionals, setLoadingProfessionals] = useState<boolean>(false);
  const [showFixedFooter, setShowFixedFooter] = useState<boolean>(true);

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

  // Limpar serviços selecionados quando mudar o profissional
  useEffect(() => {
    if (selectedProfessionalId && selectedServices.length > 0) {
      // Remover serviços que não pertencem ao profissional selecionado
      const validServices = selectedServices.filter(s => 
        s.responsibleProfessionalId === selectedProfessionalId
      );
      if (validServices.length !== selectedServices.length) {
        onSelectServices(validServices);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfessionalId]);

  const toggleService = (service: Service) => {
    const isSelected = selectedServices.some(s => s.id === service.id);
    if (isSelected) {
      onSelectServices(selectedServices.filter(s => s.id !== service.id));
    } else {
      onSelectServices([...selectedServices, service]);
    }
  };

  const handleProfessionalChange = (professionalId: string) => {
    if (professionalId === '') {
      setSelectedProfessionalId(null);
    } else {
      setSelectedProfessionalId(professionalId);
    }
    // Limpar seleção de serviços ao mudar profissional
    onSelectServices([]);
  };

  const selectedProfessional = professionals.find(p => p.id === selectedProfessionalId);

  // Detectar scroll para mostrar/esconder o rodapé fixo
  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      
      // Se estiver perto do final (100px de margem), esconder o rodapé
      const isNearBottom = scrollTop + windowHeight >= documentHeight - 100;
      setShowFixedFooter(!isNearBottom);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Verificar posição inicial

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="space-y-6 pb-20">
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
                isSelected={selectedServices.some(s => s.id === service.id)}
                onToggle={() => toggleService(service)}
              />
            ))
          )}
        </div>
        <div className="lg:col-span-1">
          <BookingSummary 
            selectedServices={selectedServices}
            totalDuration={totalDuration}
            totalPrice={totalPrice}
            onNext={onNext}
          />
        </div>
      </div>

      {/* Rodapé Fixo */}
      <FixedFooter
        selectedServices={selectedServices}
        totalPrice={totalPrice}
        onNext={onNext}
        isVisible={showFixedFooter && selectedServices.length > 0}
      />
    </div>
  );
};

export default ServiceSelector;
