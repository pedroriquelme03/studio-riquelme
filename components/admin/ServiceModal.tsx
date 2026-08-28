import React, { useState, useEffect } from 'react';
import { Service, ServicePriceVariant } from '../../types';
import { HAIR_SIZE_VARIANT_DEFS } from '../../lib/priceVariations';

interface ServiceModalProps {
  service: Service | null;
  onClose: () => void;
  onSave: (service: Service) => void;
}

function buildDefaultVariants(existing?: ServicePriceVariant[]): ServicePriceVariant[] {
  return HAIR_SIZE_VARIANT_DEFS.map((def) => {
    const found = existing?.find((v) => v.variantKey === def.key);
    return {
      variationType: 'hair_size',
      variantKey: def.key,
      label: def.label,
      price: found?.price ?? 0,
      sortOrder: def.sortOrder,
    };
  });
}

const ServiceModal: React.FC<ServiceModalProps> = ({ service, onClose, onSave }) => {
  const [formData, setFormData] = useState<Omit<Service, 'id'>>({
    name: '',
    description: '',
    price: 0,
    duration: 0,
    responsibleProfessionalId: null,
    responsibleProfessionalName: null,
    priceVariationEnabled: false,
    priceVariationType: null,
    priceVariants: [],
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
        priceVariationEnabled: Boolean(service.priceVariationEnabled),
        priceVariationType: service.priceVariationType ?? null,
        priceVariants: buildDefaultVariants(service.priceVariants),
      });
    } else {
      setFormData({
        name: '',
        description: '',
        price: 0,
        duration: 0,
        responsibleProfessionalId: null,
        responsibleProfessionalName: null,
        priceVariationEnabled: false,
        priceVariationType: null,
        priceVariants: buildDefaultVariants(),
      });
    }
  }, [service]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const isNumeric = ['price', 'duration'].includes(name);
    setFormData(prev => ({
      ...prev,
      [name]: isNumeric ? Number(value) : value,
    }));
  };

  const handleVariantPriceChange = (variantKey: string, value: string) => {
    const price = Number(value);
    setFormData((prev) => ({
      ...prev,
      priceVariants: (prev.priceVariants || []).map((v) =>
        v.variantKey === variantKey ? { ...v, price } : v,
      ),
    }));
  };

  const toggleHairSizeVariation = (enabled: boolean) => {
    setFormData((prev) => ({
      ...prev,
      priceVariationEnabled: enabled,
      priceVariationType: enabled ? 'hair_size' : null,
      priceVariants: enabled ? buildDefaultVariants(prev.priceVariants) : [],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.price <= 0 || formData.duration <= 0) {
      alert('Por favor, preencha todos os campos corretamente.');
      return;
    }
    if (formData.priceVariationEnabled) {
      const invalid = (formData.priceVariants || []).some((v) => !v.price || v.price <= 0);
      if (invalid) {
        alert('Informe preços válidos para Pequeno, Médio e Grande.');
        return;
      }
    }
    onSave({
      ...formData,
      id: service ? service.id : 0,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-surface-raised p-8 rounded-xl border border-line shadow-2xl w-full max-w-lg m-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold mb-6">{service ? 'Editar Serviço' : 'Novo Serviço'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-zinc-500 mb-1">Nome do Serviço</label>
            <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="w-full bg-surface-overlay border border-line rounded-lg p-3 focus:ring-gold focus:border-gold" required />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-zinc-500 mb-1">Descrição</label>
            <textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full bg-surface-overlay border border-line rounded-lg p-3 focus:ring-gold focus:border-gold" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-zinc-500 mb-1">Duração (minutos)</label>
              <input type="number" id="duration" name="duration" value={formData.duration} onChange={handleChange} className="w-full bg-surface-overlay border border-line rounded-lg p-3 focus:ring-gold focus:border-gold" required min="1" />
            </div>
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-zinc-500 mb-1">Preço padrão (R$)</label>
              <input type="number" id="price" name="price" value={formData.price} onChange={handleChange} className="w-full bg-surface-overlay border border-line rounded-lg p-3 focus:ring-gold focus:border-gold" required min="0.01" step="0.01" />
            </div>
          </div>

          <div className="border border-line rounded-lg p-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(formData.priceVariationEnabled)}
                onChange={(e) => toggleHairSizeVariation(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-zinc-200">
                Usar variação de valor por tamanho do cabelo
              </span>
            </label>

            {formData.priceVariationEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {(formData.priceVariants || []).map((variant) => (
                  <div key={variant.variantKey}>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">{variant.label}</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={variant.price || ''}
                      onChange={(e) => handleVariantPriceChange(variant.variantKey, e.target.value)}
                      className="w-full bg-surface-overlay border border-line rounded-lg p-2.5 focus:ring-gold focus:border-gold"
                      required
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-500 mb-1">Profissional responsável</label>
            <select
              value={formData.responsibleProfessionalId ?? ''}
              onChange={(e) => {
                const id = e.target.value || null;
                const name = professionals.find(p => p.id === id)?.name ?? null;
                setFormData(prev => ({ ...prev, responsibleProfessionalId: id, responsibleProfessionalName: name }));
              }}
              className="w-full bg-surface-overlay border border-line rounded-lg p-3 focus:ring-gold focus:border-gold"
            >
              <option value="">Sem responsável</option>
              {professionals.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-4 pt-6">
            <button type="button" onClick={onClose} className="bg-zinc-700 hover:bg-surface-overlay0 text-white font-bold py-2 px-5 rounded-lg transition-colors">Cancelar</button>
            <button type="submit" className="bg-gold hover:bg-gold text-white font-bold py-2 px-5 rounded-lg transition-colors">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServiceModal;
