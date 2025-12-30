
import React from 'react';
import { Service } from '../types';
import { CheckCircleIcon, PlusCircleIcon, ClockIcon, DollarSignIcon } from './icons';

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
      className={`bg-gray-800 p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer hover:border-amber-400 ${
        isSelected ? 'border-amber-500 shadow-lg shadow-amber-500/10' : 'border-gray-700'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-white">{service.name}</h3>
          <p className="text-gray-400 text-sm mt-1">{service.description}</p>
          <p className="text-gray-300 text-sm mt-1">
            {service.responsibleProfessionalName ? `Profissional: ${service.responsibleProfessionalName}` : 'Profissional: —'}
          </p>
          <div className="flex items-center space-x-4 mt-3 text-gray-300 text-sm">
            <span className="flex items-center"><ClockIcon className="w-4 h-4 mr-1.5 text-amber-400" /> {service.duration} min</span>
            <span className="flex items-center"><DollarSignIcon className="w-4 h-4 mr-1.5 text-amber-400" /> R${service.price.toFixed(2)}</span>
          </div>
        </div>
        {isSelected ? (
          <CheckCircleIcon className="w-7 h-7 text-amber-500 flex-shrink-0 ml-4" />
        ) : (
          <PlusCircleIcon className="w-7 h-7 text-gray-500 flex-shrink-0 ml-4" />
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
    <div className="sticky top-24 bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-xl">
        <h2 className="text-xl font-bold text-white border-b border-gray-600 pb-3 mb-4">Resumo do Agendamento</h2>
        {selectedServices.length === 0 ? (
          <p className="text-gray-400">Selecione um serviço para começar.</p>
        ) : (
          <ul className="space-y-2 mb-4">
            {selectedServices.map(s => (
              <li key={s.id} className="flex justify-between text-gray-300">
                <span>{s.name}</span>
                <span>R${s.price.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-gray-600 pt-4 mt-4 space-y-3">
          <div className="flex justify-between font-semibold">
            <span>Tempo total:</span>
            <span>{totalDuration} min</span>
          </div>
          <div className="flex justify-between font-bold text-lg text-amber-400">
            <span>Valor total:</span>
            <span>R${totalPrice.toFixed(2)}</span>
          </div>
        </div>
        <button
          onClick={onNext}
          disabled={selectedServices.length === 0}
          className="w-full bg-amber-500 text-gray-900 font-bold py-3 px-4 rounded-lg mt-6 transition-all duration-300 hover:bg-amber-400 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:text-gray-400"
        >
          Próximo
        </button>
    </div>
);

const ServiceSelector: React.FC<ServiceSelectorProps> = ({
  services,
  selectedServices,
  onSelectServices,
  onNext,
  totalDuration,
  totalPrice
}) => {
  const toggleService = (service: Service) => {
    const isSelected = selectedServices.some(s => s.id === service.id);
    if (isSelected) {
      onSelectServices(selectedServices.filter(s => s.id !== service.id));
    } else {
      onSelectServices([...selectedServices, service]);
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-4">
        <h2 className="text-2xl font-bold text-white mb-2">Nossos Serviços</h2>
        {services.map(service => (
          <ServiceItem 
            key={service.id}
            service={service}
            isSelected={selectedServices.some(s => s.id === service.id)}
            onToggle={() => toggleService(service)}
          />
        ))}
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
  );
};

export default ServiceSelector;
