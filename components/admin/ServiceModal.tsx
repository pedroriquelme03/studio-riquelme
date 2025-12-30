import React, { useState, useEffect } from 'react';
import { Service } from '../../types';

interface ServiceModalProps {
  service: Service | null;
  onClose: () => void;
  onSave: (service: Service) => void;
}

const ServiceModal: React.FC<ServiceModalProps> = ({ service, onClose, onSave }) => {
  const [formData, setFormData] = useState<Omit<Service, 'id'>>({
    name: '',
    description: '',
    price: 0,
    duration: 0,
    responsibleProfessionalId: null,
    responsibleProfessionalName: null,
  });
  const [professionals, setProfessionals] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/professionals');
        const data = await res.json();
        if (res.ok) {
          setProfessionals((data.professionals || []).map((p: any) => ({ id: p.id, name: p.name })));
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name,
        description: service.description,
        price: service.price,
        duration: service.duration,
        responsibleProfessionalId: service.responsibleProfessionalId ?? null,
        responsibleProfessionalName: service.responsibleProfessionalName ?? null,
      });
    }
  }, [service]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      const isNumeric = ['price', 'duration'].includes(name);
      setFormData(prev => ({
          ...prev,
          [name]: isNumeric ? Number(value) : value
      }));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation
    if (!formData.name || formData.price <= 0 || formData.duration <= 0) {
        alert("Por favor, preencha todos os campos corretamente.");
        return;
    }
    onSave({
        ...formData,
        id: service ? service.id : 0, // ID will be handled by parent
    });
  };

  return (
    <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
        onClick={onClose}
    >
      <div 
        className="bg-white p-8 rounded-xl border border-gray-300 shadow-2xl w-full max-w-lg m-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold mb-6">{service ? 'Editar Serviço' : 'Novo Serviço'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Nome do Serviço</label>
            <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 focus:ring-pink-600 focus:border-pink-600" required/>
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">Descrição</label>
            <textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 focus:ring-pink-600 focus:border-pink-600"></textarea>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label htmlFor="duration" className="block text-sm font-medium text-gray-300 mb-1">Duração (minutos)</label>
                <input type="number" id="duration" name="duration" value={formData.duration} onChange={handleChange} className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 focus:ring-pink-600 focus:border-pink-600" required min="1" />
            </div>
            <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-300 mb-1">Preço (R$)</label>
                <input type="number" id="price" name="price" value={formData.price} onChange={handleChange} className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 focus:ring-pink-600 focus:border-pink-600" required min="0.01" step="0.01" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Profissional responsável</label>
            <select
              value={formData.responsibleProfessionalId ?? ''}
              onChange={(e) => {
                const id = e.target.value || null;
                const name = professionals.find(p => p.id === id)?.name ?? null;
                setFormData(prev => ({ ...prev, responsibleProfessionalId: id, responsibleProfessionalName: name }));
              }}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 focus:ring-pink-600 focus:border-pink-600"
            >
              <option value="">Sem responsável</option>
              {professionals.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-4 pt-6">
            <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-5 rounded-lg transition-colors">Cancelar</button>
            <button type="submit" className="bg-pink-600 hover:bg-pink-600 text-white font-bold py-2 px-5 rounded-lg transition-colors">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServiceModal;
