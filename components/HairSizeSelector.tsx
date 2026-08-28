import React from 'react';
import { Service, ServicePriceSelection } from '../types';
import { HAIR_SIZE_DISCLAIMER } from '../lib/priceVariations';
import { CheckCircleIcon } from './icons';

interface HairSizeSelectorProps {
  service: Service;
  selected: ServicePriceSelection | null;
  onSelect: (selection: ServicePriceSelection) => void;
  onBack: () => void;
  onNext: () => void;
}

const HairSizeSelector: React.FC<HairSizeSelectorProps> = ({
  service,
  selected,
  onSelect,
  onBack,
  onNext,
}) => {
  const variants = service.priceVariants || [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold gold-text mb-2">Tamanho do cabelo</h2>
        <p className="text-zinc-300">
          Selecione o tamanho para <span className="text-white font-semibold">{service.name}</span>
        </p>
      </div>

      <div className="space-y-3">
        {variants.map((variant) => {
          const isSelected = selected?.variantKey === variant.variantKey;
          return (
            <button
              key={variant.variantKey}
              type="button"
              onClick={() => onSelect({
                variationType: variant.variationType,
                variantKey: variant.variantKey,
                label: variant.label,
                price: variant.price,
              })}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                isSelected ? 'border-gold bg-gold/10' : 'border-line bg-surface-raised hover:border-gold/60'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-white">{variant.label}</p>
                  <p className="text-gold font-bold mt-1">R$ {variant.price.toFixed(2)}</p>
                </div>
                {isSelected && <CheckCircleIcon className="w-7 h-7 text-gold flex-shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-4 text-sm text-amber-100 leading-relaxed">
        <strong className="block text-amber-200 mb-1">Atenção</strong>
        {HAIR_SIZE_DISCLAIMER}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3 px-4 border border-line text-zinc-200 rounded-lg hover:bg-surface-muted"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!selected}
          className="flex-1 py-3 px-4 bg-gold text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Escolher data e hora
        </button>
      </div>
    </div>
  );
};

export default HairSizeSelector;
