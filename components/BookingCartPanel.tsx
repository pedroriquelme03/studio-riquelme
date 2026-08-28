import React from 'react';
import { BookingCartItem } from '../types';

interface BookingCartPanelProps {
  items: BookingCartItem[];
  onRemove: (id: string) => void;
  onFinalize?: () => void;
}

const BookingCartPanel: React.FC<BookingCartPanelProps> = ({ items, onRemove, onFinalize }) => {
  if (items.length === 0) return null;

  const total = items.reduce((sum, item) => sum + item.service.price, 0);

  return (
    <div className="bg-surface-raised border border-gold/40 rounded-lg p-4 mb-6">
      <h3 className="text-white font-semibold mb-3">Seu carrinho ({items.length} item{items.length > 1 ? 's' : ''})</h3>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line/60 pb-3 last:border-0 last:pb-0">
            <div className="text-sm text-zinc-200">
              <p className="font-medium text-white">{item.service.name}</p>
              {item.priceSelection && (
                <p className="text-xs text-zinc-400">Tamanho: {item.priceSelection.label}</p>
              )}
              {item.usePlanBenefit && (
                <p className="text-xs text-green-400">Incluso no plano</p>
              )}
              <p className="text-zinc-400">
                {item.date.toLocaleDateString('pt-BR')} às {item.time}
                {item.professionalName ? ` · ${item.professionalName}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gold font-semibold">R$ {item.service.price.toFixed(2)}</span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="text-xs text-red-400 hover:underline"
              >
                Remover
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-between mt-4 pt-3 border-t border-line font-bold text-gold">
        <span>Total acumulado</span>
        <span>R$ {total.toFixed(2)}</span>
      </div>
      {onFinalize && (
        <button
          type="button"
          onClick={onFinalize}
          className="w-full mt-4 py-3 bg-gold text-white font-semibold rounded-lg"
        >
          Finalizar agendamento
        </button>
      )}
    </div>
  );
};

export default BookingCartPanel;
