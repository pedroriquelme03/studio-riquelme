import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function normalizePhone(phone: string) {
  return (phone || '').replace(/\D/g, '');
}

// Mesma máscara usada em "Seus dados"
function applyPhoneMask(value: string): string {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) {
    return numbers.length > 0 ? `(${numbers}` : numbers;
  } else if (numbers.length <= 7) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  } else if (numbers.length <= 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  } else {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  }
}

function toE164(digits: string): string {
  // Se começar com '55' (Brasil), prefixa '+'
  if (digits.startsWith('55')) return `+${digits}`;
  // Caso típico BR (11 dígitos) sem DDI, adiciona +55
  if (digits.length === 11) return `+55${digits}`;
  // Fallback: tenta adicionar +
  return digits.startsWith('+') ? digits : `+${digits}`;
}

const ClientLoginPage: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const digits = normalizePhone(phone);
      if (usePassword) {
        const res = await fetch('/api/client-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login_password', phone: digits, password }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.error || 'Não foi possível entrar');
        localStorage.setItem('client_phone', digits);
        navigate('/meus-agendamentos');
      } else {
        const res = await fetch('/api/client-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login', phone: digits }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.error || 'Não foi possível entrar');
        localStorage.setItem('client_phone', digits);
        navigate('/meus-agendamentos');
      }
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl border border-gray-300 shadow-xl">
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">Entrar</h2>
      <p className="text-gray-600 text-center mb-6">Acesse seu histórico com seu WhatsApp</p>

      <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(applyPhoneMask(e.target.value))}
              onKeyDown={(e) => {
                const code = (e as any).keyCode as number;
                if ([8,9,27,13,46,35,36,37,38,39,40].includes(code) ||
                    (code === 65 && (e as any).ctrlKey) ||
                    (code === 67 && (e as any).ctrlKey) ||
                    (code === 86 && (e as any).ctrlKey) ||
                    (code === 88 && (e as any).ctrlKey)) {
                  return;
                }
                if (((e as any).shiftKey || code < 48 || code > 57) && (code < 96 || code > 105)) {
                  e.preventDefault();
                }
              }}
              maxLength={15}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900"
              placeholder="(99) 99999-9999"
              required
            />
          </div>

        <div className="flex items-center gap-2">
          <input id="usePassword" type="checkbox" checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} />
          <label htmlFor="usePassword" className="text-sm text-gray-800">Entrar com senha</label>
        </div>

        {usePassword && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900"
              placeholder="Sua senha"
              minLength={6}
              required={usePassword}
            />
          </div>
        )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
      </form>
    </div>
  );
};

export default ClientLoginPage;


