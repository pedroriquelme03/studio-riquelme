import React, { useState } from 'react';
import { BookingCartItem, Service } from '../types';

interface BookingCartModalProps {
  service: Service;
  date: Date;
  time: string;
  professionalName?: string | null;
  priceSelection?: BookingCartItem['priceSelection'];
  cartItems: BookingCartItem[];
  cartTotal: number;
  onClose: () => void;
  onAddMore: () => Promise<void>;
  onFinalize: () => Promise<void>;
}

const BookingCartModal: React.FC<BookingCartModalProps> = ({
  service,
  date,
  time,
  professionalName,
  priceSelection,
  cartItems,
  cartTotal,
  onClose,
  onAddMore,
  onFinalize,
}) => {
  const [loading, setLoading] = useState<'add' | 'finalize' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const itemTotal = service.price;
  const grandTotal = cartTotal + itemTotal;

  const run = async (action: 'add' | 'finalize') => {
    setLoading(action);
    setError(null);
    try {
      if (action === 'add') await onAddMore();
      else await onFinalize();
    } catch (e: any) {
      setError(e?.message || 'Não foi possível concluir esta ação.');
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-surface-raised border border-line rounded-2xl shadow-xl max-w-lg w-full p-6">
        <h3 className="text-xl font-bold text-white mb-2">Item configurado</h3>
        <p className="text-sm text-zinc-400 mb-4">Deseja adicionar mais serviços ou finalizar o agendamento?</p>

        <div className="bg-surface-overlay border border-line rounded-lg p-4 mb-4 text-sm text-zinc-200 space-y-1">
          <p><span className="text-zinc-400">Serviço:</span> {service.name}</p>
          {priceSelection && (
            <p><span className="text-zinc-400">Tamanho:</span> {priceSelection.label}</p>
          )}
          {professionalName && <p><span className="text-zinc-400">Profissional:</span> {professionalName}</p>}
          <p><span className="text-zinc-400">Data:</span> {date.toLocaleDateString('pt-BR')}</p>
          <p><span className="text-zinc-400">Horário:</span> {time}</p>
          <p><span className="text-zinc-400">Valor:</span> R$ {service.price.toFixed(2)}</p>
        </div>

        {cartItems.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-zinc-400 mb-2">Itens já no carrinho ({cartItems.length})</p>
            <ul className="text-sm text-zinc-300 space-y-1 max-h-32 overflow-y-auto">
              {cartItems.map((item) => (
                <li key={item.id} className="flex justify-between gap-2">
                  <span>{item.service.name} — {item.date.toLocaleDateString('pt-BR')} {item.time}</span>
                  <span>R$ {item.service.price.toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <p className="text-right text-gold font-semibold mt-2">
              Total com este item: R$ {grandTotal.toFixed(2)}
            </p>
          </div>
        )}

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => run('add')}
            disabled={!!loading}
            className="flex-1 py-3 px-4 border border-gold text-gold font-semibold rounded-lg hover:bg-gold/10 disabled:opacity-50"
          >
            {loading === 'add' ? 'Validando...' : 'Adicionar mais um item'}
          </button>
          <button
            type="button"
            onClick={() => run('finalize')}
            disabled={!!loading}
            className="flex-1 py-3 px-4 bg-gold text-white font-semibold rounded-lg disabled:opacity-50"
          >
            {loading === 'finalize' ? 'Validando...' : 'Finalizar agendamento'}
          </button>
        </div>
        <button type="button" onClick={onClose} className="w-full mt-3 text-sm text-zinc-400 hover:text-white">
          Voltar e alterar horário
        </button>
      </div>
    </div>
  );
};

export default BookingCartModal;
