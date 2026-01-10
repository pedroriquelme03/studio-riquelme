
import React, { useState } from 'react';
import { Booking } from '../types';
import { CalendarIcon, ClockIcon, DollarSignIcon, CheckCircleIcon, UserIcon } from './icons';
import { getSupabaseClient } from '@/src/lib/supabaseClient';

interface ConfirmationPageProps {
  booking: Booking;
  onNewBooking: () => void;
}

const ConfirmationPage: React.FC<ConfirmationPageProps> = ({ booking, onNewBooking }) => {
  const { services, date, time, client } = booking;
  const totalDuration = services.reduce((total, s) => total + s.duration, 0);
  const totalPrice = services.reduce((total, s) => total + s.price, 0);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [email, setEmail] = useState(client.email || '');
  const [phone, setPhone] = useState(client.phone || '');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);
    try {
      const digits = (phone || '').replace(/\D/g, '');
      if (!digits) {
        setFeedback('Informe um WhatsApp válido.');
        return;
      }
      if (!password || password.length < 6) {
        setFeedback('A senha deve ter no mínimo 6 caracteres.');
        return;
      }

      // Registrar conta pelo backend (sem confirmação)
      const res = await fetch('/api/client-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', name: client.name, phone: digits, email: email || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao registrar conta');

      // Definir senha do cliente
      const resPass = await fetch('/api/client-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_password', phone: digits, email: email || null, password }),
      });
      const dataPass = await resPass.json();
      if (!resPass.ok || !dataPass.ok) throw new Error(dataPass?.error || 'Falha ao definir a senha');

      // Salvar sessão simples do cliente pelo telefone
      localStorage.setItem('client_phone', digits);

      setFeedback('Conta criada! Você já pode acessar seu histórico com seu WhatsApp e senha.');
    } catch (err: any) {
      setFeedback(err?.message || 'Não foi possível criar a conta.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto text-center">
      <CheckCircleIcon className="w-20 h-20 text-green-500 mx-auto mb-4" />
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Agendamento Confirmado!</h2>
      <p className="text-gray-700 mb-8">Obrigado, {client.name}. Seu horário está reservado.</p>

      <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-300 shadow-xl text-left space-y-6">
        <h3 className="text-xl font-bold text-gray-900 border-b border-gray-300 pb-3">Resumo do Agendamento</h3>
        
        <div>
          <h4 className="font-semibold text-pink-600 mb-2">Serviços</h4>
          <ul className="space-y-1">
            {services.map(s => (
              <li key={s.id} className="flex justify-between text-gray-700">
                <span>{s.name}</span>
                <span>R${s.price.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="grid sm:grid-cols-2 gap-4 border-t border-gray-300 pt-4">
            <div className="flex items-center">
                <CalendarIcon className="w-5 h-5 mr-3 text-pink-600"/>
                <div>
                    <span className="text-sm text-gray-600">Data</span>
                    <p className="font-semibold text-gray-900">{date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
            </div>
            <div className="flex items-center">
                <ClockIcon className="w-5 h-5 mr-3 text-pink-600"/>
                <div>
                    <span className="text-sm text-gray-600">Hora</span>
                    <p className="font-semibold text-gray-900">{time}</p>
                </div>
            </div>
             <div className="flex items-center">
                <UserIcon className="w-5 h-5 mr-3 text-pink-600"/>
                <div>
                    <span className="text-sm text-gray-600">Cliente</span>
                    <p className="font-semibold text-gray-900">{client.name}</p>
                </div>
            </div>
             <div className="flex items-center">
                <DollarSignIcon className="w-5 h-5 mr-3 text-pink-600"/>
                <div>
                    <span className="text-sm text-gray-600">Total</span>
                    <p className="font-semibold text-gray-900">R${totalPrice.toFixed(2)}</p>
                </div>
            </div>
        </div>

        {/* Mensagem de WhatsApp temporariamente removida */}
      </div>

      {/* CTA: Criar conta para histórico */}
      <div className="mt-6 bg-white p-6 rounded-2xl border border-gray-300 shadow-xl text-left">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Quer acompanhar seu histórico de atendimentos?</h3>
        <p className="text-gray-700 mb-4">
          Crie sua conta com seu WhatsApp e tenha acesso aos seus agendamentos.
        </p>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="bg-gray-900 hover:bg-black text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          Criar conta com WhatsApp
        </button>
      </div>

      <button
        onClick={onNewBooking}
        className="mt-8 bg-pink-600 hover:bg-pink-600 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 shadow-md"
      >
        Agendar outro horário
      </button>

      {/* Modal de criação de conta via WhatsApp */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-300 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xl font-bold text-gray-900">Criar conta com WhatsApp</h4>
              <button
                onClick={() => { setIsCreateOpen(false); setFeedback(null); }}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={client.name}
                  readOnly
                  className="w-full bg-gray-100 border border-gray-300 rounded-lg p-3 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900"
                  placeholder="(99) 99999-9999"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email (opcional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900"
                  placeholder="seuemail@exemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900"
                  placeholder="Crie uma senha (mín. 6 caracteres)"
                  minLength={6}
                  required
                />
              </div>

              {feedback && (
                <div className="bg-gray-50 border border-gray-300 text-gray-800 px-4 py-3 rounded-lg text-sm">
                  {feedback}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsCreateOpen(false); setFeedback(null); }}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-pink-600 text-white font-semibold hover:bg-pink-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Criando...' : 'Criar conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfirmationPage;
