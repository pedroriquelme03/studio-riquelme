import React, { useEffect, useState } from 'react';
import { Service } from '../../types';
import { ClockIcon, DollarSignIcon, PencilIcon, PlusCircleIcon, TrashIcon } from '../icons';
import ServiceModal from './ServiceModal';

const ServicesView: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/services');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar serviços');
      setServices((data.services || []) as Service[]);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar serviços');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleOpenModal = (service: Service | null = null) => {
    setEditingService(service);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
  };

  const handleSaveService = async (service: Service) => {
    try {
      setLoading(true);
      setError(null);
      if (editingService) {
        const res = await fetch('/api/services', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingService.id,
            name: service.name,
            price: service.price,
            duration: service.duration,
            description: service.description,
            responsibleProfessionalId: service.responsibleProfessionalId ?? null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erro ao atualizar serviço');
      } else {
        const res = await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: service.name,
            price: service.price,
            duration: service.duration,
            description: service.description,
            responsibleProfessionalId: service.responsibleProfessionalId ?? null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erro ao criar serviço');
      }
      await load();
      handleCloseModal();
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar serviço');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteService = async (serviceId: number) => {
    if (!window.confirm("Tem certeza que deseja excluir este serviço?")) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/services?id=${serviceId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erro ao excluir serviço');
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao excluir serviço');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">Gerenciar Serviços</h2>
      <div className="flex justify-center items-center mb-6">
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center space-x-2 bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
        >
          <PlusCircleIcon className="w-5 h-5" />
          <span>Novo Serviço</span>
        </button>
      </div>

      {error && <div className="text-red-400 mb-4">{error}</div>}
      {/* Tabela desktop */}
      <div className="hidden md:block bg-white border border-gray-300 rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-100/50">
            <tr>
              <th className="p-4 font-semibold">Serviço</th>
              <th className="p-4 font-semibold">Profissional</th>
              <th className="p-4 font-semibold text-center">Duração</th>
              <th className="p-4 font-semibold text-center">Preço</th>
              <th className="p-4 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {services.map(service => (
              <tr key={service.id} className="hover:bg-gray-100/40">
                <td className="p-4">
                    <p className="font-bold">{service.name}</p>
                    <p className="text-sm text-gray-600 max-w-md">{service.description}</p>
                </td>
                <td className="p-4">
                  <span className="text-gray-200">{service.responsibleProfessionalName || '—'}</span>
                </td>
                <td className="p-4 text-center">
                    <span className="flex items-center justify-center"><ClockIcon className="w-4 h-4 mr-1.5 text-pink-600"/> {service.duration} min</span>
                </td>
                <td className="p-4 text-center">
                    <span className="flex items-center justify-center"><DollarSignIcon className="w-4 h-4 mr-1.5 text-pink-600"/> R${service.price.toFixed(2)}</span>
                </td>
                <td className="p-4 text-right">
                    <div className="inline-flex space-x-3">
                        <button onClick={() => handleOpenModal(service)} className="text-gray-700 hover:text-blue-400"><PencilIcon className="w-5 h-5"/></button>
                        <button onClick={() => handleDeleteService(service.id)} className="text-gray-700 hover:text-red-400"><TrashIcon className="w-5 h-5"/></button>
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards mobile */}
      <div className="md:hidden grid gap-3">
        {services.map(service => (
          <div key={service.id} className="bg-white border border-gray-300 rounded-lg p-4">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="font-bold text-gray-900 truncate">{service.name}</p>
                <p className="text-sm text-gray-600">{service.description}</p>
                <p className="text-gray-700 text-sm mt-1">
                  {service.responsibleProfessionalName ? `Profissional: ${service.responsibleProfessionalName}` : 'Profissional: —'}
                </p>
              </div>
              <div className="inline-flex space-x-3">
                <button onClick={() => handleOpenModal(service)} className="text-gray-700 hover:text-blue-400"><PencilIcon className="w-5 h-5"/></button>
                <button onClick={() => handleDeleteService(service.id)} className="text-gray-700 hover:text-red-400"><TrashIcon className="w-5 h-5"/></button>
              </div>
            </div>
            <div className="flex justify-between text-sm text-gray-700 mt-3">
              <span className="flex items-center"><ClockIcon className="w-4 h-4 mr-1.5 text-pink-600"/> {service.duration} min</span>
              <span className="flex items-center"><DollarSignIcon className="w-4 h-4 mr-1.5 text-pink-600"/> R${service.price.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <ServiceModal
          service={editingService}
          onClose={handleCloseModal}
          onSave={handleSaveService}
        />
      )}
    </div>
  );
};

export default ServicesView;
