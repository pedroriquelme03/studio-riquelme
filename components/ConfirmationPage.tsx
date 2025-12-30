
import React from 'react';
import { Booking } from '../types';
import { CalendarIcon, ClockIcon, DollarSignIcon, CheckCircleIcon, UserIcon } from './icons';

interface ConfirmationPageProps {
  booking: Booking;
  onNewBooking: () => void;
}

const ConfirmationPage: React.FC<ConfirmationPageProps> = ({ booking, onNewBooking }) => {
  const { services, date, time, client } = booking;
  const totalDuration = services.reduce((total, s) => total + s.duration, 0);
  const totalPrice = services.reduce((total, s) => total + s.price, 0);
  
  return (
    <div className="max-w-2xl mx-auto text-center">
      <CheckCircleIcon className="w-20 h-20 text-green-400 mx-auto mb-4" />
      <h2 className="text-3xl font-bold text-white mb-2">Agendamento Confirmado!</h2>
      <p className="text-gray-300 mb-8">Obrigado, {client.name}. Seu horário está reservado.</p>

      <div className="bg-gray-800/50 p-6 md:p-8 rounded-2xl border border-gray-700 shadow-xl text-left space-y-6">
        <h3 className="text-xl font-bold text-white border-b border-gray-600 pb-3">Resumo do Agendamento</h3>
        
        <div>
          <h4 className="font-semibold text-amber-400 mb-2">Serviços</h4>
          <ul className="space-y-1">
            {services.map(s => (
              <li key={s.id} className="flex justify-between text-gray-300">
                <span>{s.name}</span>
                <span>R${s.price.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="grid sm:grid-cols-2 gap-4 border-t border-gray-600 pt-4">
            <div className="flex items-center">
                <CalendarIcon className="w-5 h-5 mr-3 text-amber-400"/>
                <div>
                    <span className="text-sm text-gray-400">Data</span>
                    <p className="font-semibold">{date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
            </div>
            <div className="flex items-center">
                <ClockIcon className="w-5 h-5 mr-3 text-amber-400"/>
                <div>
                    <span className="text-sm text-gray-400">Hora</span>
                    <p className="font-semibold">{time}</p>
                </div>
            </div>
             <div className="flex items-center">
                <UserIcon className="w-5 h-5 mr-3 text-amber-400"/>
                <div>
                    <span className="text-sm text-gray-400">Cliente</span>
                    <p className="font-semibold">{client.name}</p>
                </div>
            </div>
             <div className="flex items-center">
                <DollarSignIcon className="w-5 h-5 mr-3 text-amber-400"/>
                <div>
                    <span className="text-sm text-gray-400">Total</span>
                    <p className="font-semibold">R${totalPrice.toFixed(2)}</p>
                </div>
            </div>
        </div>

        <p className="text-sm text-center text-gray-400 pt-4">
          Enviamos um e-mail de confirmação para <span className="font-semibold text-amber-300">{client.email}</span> com todos os detalhes.
        </p>
      </div>

      <button
        onClick={onNewBooking}
        className="mt-8 bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold py-3 px-6 rounded-lg transition-colors duration-300"
      >
        Agendar outro horário
      </button>
    </div>
  );
};

export default ConfirmationPage;
