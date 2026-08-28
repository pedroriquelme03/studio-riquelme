import React, { useEffect, useState } from 'react';
import { Promotion } from '../types';
import { ClockIcon, DollarSignIcon, CheckCircleIcon } from './icons';

interface PromotionSelectorProps {
  selectedPromotion: Promotion | null;
  onSelectPromotion: (promotion: Promotion | null) => void;
  onNext: () => void;
}

const PromotionSelector: React.FC<PromotionSelectorProps> = ({ selectedPromotion, onSelectPromotion, onNext }) => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/services?promotions=1');
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Erro ao carregar promoções');
        setPromotions((data.promotions || []) as Promotion[]);
      } catch (e: any) {
        setError(e.message || 'Erro ao carregar promoções');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold gold-text mb-6 text-center">Escolha uma Promoção</h2>
      {error && <div className="text-red-400 mb-4 text-center">{error}</div>}
      {loading && <div className="text-zinc-300 text-center">Carregando promoções...</div>}
      {!loading && promotions.length === 0 && (
        <p className="text-zinc-400 text-center py-8">Nenhuma promoção disponível no momento.</p>
      )}
      <div className="grid gap-4">
        {promotions.map((promo) => {
          const selected = selectedPromotion?.id === promo.id;
          return (
            <button
              key={promo.id}
              type="button"
              onClick={() => onSelectPromotion(selected ? null : promo)}
              className={`text-left p-5 rounded-lg border-2 transition-all ${selected ? 'border-gold bg-surface-raised shadow-lg shadow-gold' : 'border-line bg-surface-raised hover:border-gold'}`}
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{promo.name}</h3>
                  {promo.description && <p className="text-sm text-zinc-400 mt-1">{promo.description}</p>}
                  <ol className="mt-3 space-y-1 text-sm text-zinc-300 list-decimal list-inside">
                    {promo.items.map((item) => (
                      <li key={item.sortOrder}>
                        {item.serviceName} — {item.professionalName} ({item.serviceDuration || 30} min)
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center justify-end text-gold font-bold text-xl">
                    <DollarSignIcon className="w-5 h-5 mr-1" />
                    R$ {promo.totalPrice.toFixed(2)}
                  </div>
                  <div className="flex items-center justify-end text-zinc-400 text-sm mt-2">
                    <ClockIcon className="w-4 h-4 mr-1" />
                    {promo.items.reduce((s, i) => s + (i.serviceDuration || 30), 0) + promo.gapMinutes * Math.max(promo.items.length - 1, 0)} min
                  </div>
                  {selected && <CheckCircleIcon className="w-7 h-7 text-gold ml-auto mt-2" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {selectedPromotion && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={onNext}
            className="bg-gold text-white font-bold py-3 px-8 rounded-lg shadow-md"
          >
            Escolher data e hora
          </button>
        </div>
      )}
    </div>
  );
};

export default PromotionSelector;
