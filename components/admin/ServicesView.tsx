import React, { useEffect, useMemo, useState } from 'react';
import { Service } from '../../types';
import { formatServicePriceLabel } from '../../lib/priceVariations';
import { ClockIcon, DollarSignIcon, PencilIcon, PlusCircleIcon, TrashIcon } from '../icons';
import ServiceModal from './ServiceModal';

type ProfessionalOption = { id: string; name: string };

const ServicesView: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [professionalFilter, setProfessionalFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [svcRes, profRes] = await Promise.all([
        fetch('/api/services'),
        fetch('/api/professionals'),
      ]);
      const [svcData, profData] = await Promise.all([svcRes.json(), profRes.json()]);
      if (!svcRes.ok) throw new Error(svcData?.error || 'Erro ao carregar serviços');
      setServices((svcData.services || []) as Service[]);
      if (profRes.ok) {
        setProfessionals((profData.professionals || []).map((p: any) => ({ id: p.id, name: p.name })));
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar serviços');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredServices = useMemo(() => {
    if (!professionalFilter) return services;
    if (professionalFilter === '__none__') {
      return services.filter((s) => !s.responsibleProfessionalId);
    }
    return services.filter((s) => s.responsibleProfessionalId === professionalFilter);
  }, [services, professionalFilter]);

  const handleOpenModal = (service: Service | null = null) => {
    setEditingService(service);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
  };

  const servicePayload = (service: Service) => ({
    name: service.name,
    price: service.price,
    duration: service.duration,
    description: service.description,
    responsibleProfessionalId: service.responsibleProfessionalId ?? null,
    priceVariationEnabled: service.priceVariationEnabled ?? false,
    priceVariationType: service.priceVariationType ?? null,
    priceVariants: service.priceVariants ?? [],
  });

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
            ...servicePayload(service),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erro ao atualizar serviço');
      } else {
        const res = await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(servicePayload(service)),
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
      <h2 className="text-2xl font-bold gold-text text-center mb-6">Gerenciar Serviços</h2>
      <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-end gap-4 mb-6 max-w-xl mx-auto">
        <div className="flex-1">
          <label htmlFor="service-professional-filter" className="block text-sm text-zinc-300 mb-1">
            Filtrar por profissional
          </label>
          <select
            id="service-professional-filter"
            value={professionalFilter}
            onChange={(e) => setProfessionalFilter(e.target.value)}
            className="w-full bg-surface-raised text-white border border-line rounded px-3 py-2"
          >
            <option value="">Todos os profissionais</option>
            <option value="__none__">Sem profissional</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center space-x-2 bg-gold hover:brightness-110 text-white font-bold py-2 px-4 rounded-lg transition-colors whitespace-nowrap"
        >
          <PlusCircleIcon className="w-5 h-5" />
          <span>Novo Serviço</span>
        </button>
      </div>

      {professionalFilter && (
        <p className="text-sm text-zinc-400 text-center mb-4">
          {filteredServices.length} serviço{filteredServices.length === 1 ? '' : 's'} encontrado{filteredServices.length === 1 ? '' : 's'}
        </p>
      )}

      {error && <div className="text-red-400 mb-4">{error}</div>}
      {loading && services.length === 0 && (
        <p className="text-zinc-400 text-center mb-4">Carregando serviços...</p>
      )}
      {!loading && filteredServices.length === 0 && (
        <p className="text-zinc-400 text-center mb-4">
          {professionalFilter ? 'Nenhum serviço encontrado para este filtro.' : 'Nenhum serviço cadastrado.'}
        </p>
      )}
      {/* Tabela desktop */}
      <div className="hidden md:block bg-surface-raised border border-line rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-surface-muted/50">
            <tr>
              <th className="p-4 font-semibold">Serviço</th>
              <th className="p-4 font-semibold">Profissional</th>
              <th className="p-4 font-semibold text-center">Duração</th>
              <th className="p-4 font-semibold text-center">Preço</th>
              <th className="p-4 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredServices.map(service => (
              <tr key={service.id} className="hover:bg-surface-muted/40">
                <td className="p-4">
                    <p className="font-bold">{service.name}</p>
                    <p className="text-sm text-zinc-300 max-w-md">{service.description}</p>
                </td>
                <td className="p-4">
                  <span className="text-gray-200">{service.responsibleProfessionalName || '—'}</span>
                </td>
                <td className="p-4 text-center">
                    <span className="flex items-center justify-center"><ClockIcon className="w-4 h-4 mr-1.5 text-gold"/> {service.duration} min</span>
                </td>
                <td className="p-4 text-center">
                    <span className="flex items-center justify-center"><DollarSignIcon className="w-4 h-4 mr-1.5 text-gold"/> {formatServicePriceLabel(service)}</span>
                </td>
                <td className="p-4 text-right">
                    <div className="inline-flex space-x-3">
                        <button onClick={() => handleOpenModal(service)} className="text-zinc-200 hover:text-blue-400"><PencilIcon className="w-5 h-5"/></button>
                        <button onClick={() => handleDeleteService(service.id)} className="text-zinc-200 hover:text-red-400"><TrashIcon className="w-5 h-5"/></button>
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards mobile */}
      <div className="md:hidden grid gap-3">
        {filteredServices.map(service => (
          <div key={service.id} className="bg-surface-raised border border-line rounded-lg p-4">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="font-bold text-white truncate">{service.name}</p>
                <p className="text-sm text-zinc-300">{service.description}</p>
                <p className="text-zinc-200 text-sm mt-1">
                  {service.responsibleProfessionalName ? `Profissional: ${service.responsibleProfessionalName}` : 'Profissional: —'}
                </p>
              </div>
              <div className="inline-flex space-x-3">
                <button onClick={() => handleOpenModal(service)} className="text-zinc-200 hover:text-blue-400"><PencilIcon className="w-5 h-5"/></button>
                <button onClick={() => handleDeleteService(service.id)} className="text-zinc-200 hover:text-red-400"><TrashIcon className="w-5 h-5"/></button>
              </div>
            </div>
            <div className="flex justify-between text-sm text-zinc-200 mt-3">
              <span className="flex items-center"><ClockIcon className="w-4 h-4 mr-1.5 text-gold"/> {service.duration} min</span>
              <span className="flex items-center"><DollarSignIcon className="w-4 h-4 mr-1.5 text-gold"/> {formatServicePriceLabel(service)}</span>
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
