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
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
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
      
      if (isRegisterMode) {
        // Criar conta
        if (!name.trim()) {
          setError('Nome é obrigatório');
          setIsLoading(false);
          return;
        }
        if (!password || password.length < 6) {
          setError('A senha deve ter no mínimo 6 caracteres');
          setIsLoading(false);
          return;
        }

        // Registrar conta
        const res = await fetch('/api/client-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'register', name: name.trim(), phone: digits }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao registrar conta');

        // Definir senha do cliente
        const resPass = await fetch('/api/client-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set_password', phone: digits, password }),
        });
        const dataPass = await resPass.json();
        if (!resPass.ok || !dataPass.ok) throw new Error(dataPass?.error || 'Falha ao definir a senha');

        // Salvar sessão e redirecionar
        localStorage.setItem('client_phone', digits);
        navigate('/meus-agendamentos');
      } else {
        // Login
        const res = await fetch('/api/client-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login_password', phone: digits, password }),
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
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">
        {isRegisterMode ? 'Criar Conta' : 'Entrar'}
      </h2>
      <p className="text-gray-600 text-center mb-6">
        {isRegisterMode 
          ? 'Crie sua conta para acessar seu histórico de agendamentos' 
          : 'Acesse seu histórico com seu WhatsApp'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isRegisterMode && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900"
              placeholder="Seu nome completo"
              required
            />
          </div>
        )}

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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900"
            placeholder={isRegisterMode ? 'Mínimo 6 caracteres' : 'Sua senha'}
            minLength={6}
            required
          />
        </div>

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
          {isLoading 
            ? (isRegisterMode ? 'Criando conta...' : 'Entrando...') 
            : (isRegisterMode ? 'Criar Conta' : 'Entrar')}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => {
            setIsRegisterMode(!isRegisterMode);
            setError(null);
            setName('');
            setPhone('');
            setPassword('');
          }}
          className="text-pink-600 hover:text-pink-700 text-sm font-medium"
        >
          {isRegisterMode 
            ? 'Já tem uma conta? Entrar' 
            : 'Não tem uma conta? Criar conta'}
        </button>
      </div>
    </div>
  );
};

export default ClientLoginPage;


