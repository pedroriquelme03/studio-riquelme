
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
      className={`bg-white p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer hover:border-amber-400 shadow-sm ${
        isSelected ? 'border-amber-500 shadow-lg shadow-amber-500/20' : 'border-gray-300'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{service.name}</h3>
          <p className="text-gray-600 text-sm mt-1">{service.description}</p>
          <p className="text-gray-700 text-sm mt-1">
            {service.responsibleProfessionalName ? `Profissional: ${service.responsibleProfessionalName}` : 'Profissional: —'}
          </p>
          <div className="flex items-center space-x-4 mt-3 text-gray-700 text-sm">
            <span className="flex items-center"><ClockIcon className="w-4 h-4 mr-1.5 text-amber-500" /> {service.duration} min</span>
            <span className="flex items-center"><DollarSignIcon className="w-4 h-4 mr-1.5 text-amber-500" /> R${service.price.toFixed(2)}</span>
          </div>
        </div>
        {isSelected ? (
          <CheckCircleIcon className="w-7 h-7 text-amber-500 flex-shrink-0 ml-4" />
        ) : (
          <PlusCircleIcon className="w-7 h-7 text-gray-400 flex-shrink-0 ml-4" />
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
    <div className="sticky top-24 bg-white p-6 rounded-lg border border-gray-300 shadow-xl">
        <h2 className="text-xl font-bold text-gray-900 border-b border-gray-300 pb-3 mb-4">Resumo do Agendamento</h2>
        {selectedServices.length === 0 ? (
          <p className="text-gray-600">Selecione um serviço para começar.</p>
        ) : (
          <ul className="space-y-2 mb-4">
            {selectedServices.map(s => (
              <li key={s.id} className="flex justify-between text-gray-700">
                <span>{s.name}</span>
                <span>R${s.price.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-gray-300 pt-4 mt-4 space-y-3">
          <div className="flex justify-between font-semibold text-gray-900">
            <span>Tempo total:</span>
            <span>{totalDuration} min</span>
          </div>
          <div className="flex justify-between font-bold text-lg text-amber-500">
            <span>Valor total:</span>
            <span>R${totalPrice.toFixed(2)}</span>
          </div>
        </div>
        <button
          onClick={onNext}
          disabled={selectedServices.length === 0}
          className="w-full bg-amber-500 text-white font-bold py-3 px-4 rounded-lg mt-6 transition-all duration-300 hover:bg-amber-400 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-500 shadow-md"
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
      className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 shadow-lg z-40 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">
                {selectedServices.length === 1 
                  ? selectedServices[0].name 
                  : `${selectedServices.length} serviços selecionados`}
              </span>
            </div>
            <div className="text-lg font-bold text-amber-500">
              R$ {totalPrice.toFixed(2)}
            </div>
          </div>
          <button
            onClick={onNext}
            className="bg-amber-500 hover:bg-amber-400 text-white font-bold py-2.5 px-6 rounded-lg transition-all duration-300 shadow-md whitespace-nowrap"
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

  // Filtrar serviços baseado no profissional selecionado
  const filteredServices = useMemo(() => {
    if (!selectedProfessionalId) {
      return services; // Mostrar todos os serviços se nenhum profissional estiver selecionado
    }
    return services.filter(service => 
      service.responsibleProfessionalId === selectedProfessionalId
    );
  }, [services, selectedProfessionalId]);

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
      <div className="bg-white p-4 rounded-lg border border-gray-300 shadow-sm">
        <label htmlFor="professional-select" className="block text-sm font-medium text-gray-700 mb-2">
          <UserIcon className="w-5 h-5 inline mr-2 text-amber-500" />
          Selecionar Profissional
        </label>
        <select
          id="professional-select"
          value={selectedProfessionalId || ''}
          onChange={(e) => handleProfessionalChange(e.target.value)}
          className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900 focus:ring-amber-500 focus:border-amber-500"
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
          <p className="mt-2 text-sm text-gray-600">
            Mostrando serviços de: <span className="font-semibold text-amber-600">{selectedProfessional.name}</span>
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Nossos Serviços</h2>
          {filteredServices.length === 0 ? (
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-8 text-center">
              <p className="text-gray-600">
                {selectedProfessionalId 
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
