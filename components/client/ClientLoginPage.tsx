import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Mode = 'login' | 'register' | 'forgot_request' | 'forgot_confirm';

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

const MIN_PASSWORD = 8;

const inputClass = 'w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

async function postClientAuth(payload: Record<string, unknown>) {
  const res = await fetch('/api/client-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  return { res, data };
}

const ClientLoginPage: React.FC = () => {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const resetMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const goTo = (next: Mode) => {
    resetMessages();
    setPassword('');
    setConfirmPassword('');
    setCode('');
    if (next === 'register' || next === 'login') setName('');
    setMode(next);
  };

  const enter = (digits: string) => {
    // Guardado apenas para exibir o número na tela; quem autoriza de verdade é
    // o cookie de sessão HttpOnly emitido pela API.
    try {
      localStorage.setItem('client_phone', digits);
    } catch {}
    navigate('/meus-agendamentos');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setIsLoading(true);

    try {
      const digits = normalizePhone(phone);

      if (mode === 'forgot_request') {
        const { res, data } = await postClientAuth({ action: 'request_reset', phone: digits });
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'Não foi possível enviar o código');
        setSuccessMessage(
          data.message || 'Se houver uma conta para este WhatsApp, você receberá um código em instantes.',
        );
        setMode('forgot_confirm');
        return;
      }

      if (mode === 'forgot_confirm') {
        if (password.length < MIN_PASSWORD) {
          setError(`A senha deve ter no mínimo ${MIN_PASSWORD} caracteres`);
          return;
        }
        if (password !== confirmPassword) {
          setError('As senhas não coincidem');
          return;
        }
        const { res, data } = await postClientAuth({
          action: 'reset_with_code',
          phone: digits,
          code,
          new_password: password,
        });
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'Não foi possível redefinir a senha');
        enter(digits);
        return;
      }

      if (mode === 'register') {
        if (!name.trim()) {
          setError('Nome é obrigatório');
          return;
        }
        if (password.length < MIN_PASSWORD) {
          setError(`A senha deve ter no mínimo ${MIN_PASSWORD} caracteres`);
          return;
        }
        const { res, data } = await postClientAuth({
          action: 'register',
          name: name.trim(),
          phone: digits,
          password,
        });
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'Falha ao criar a conta');
        enter(digits);
        return;
      }

      const { res, data } = await postClientAuth({
        action: 'login_password',
        phone: digits,
        password,
      });
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Não foi possível entrar');
      enter(digits);
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  const title =
    mode === 'forgot_request' || mode === 'forgot_confirm'
      ? 'Redefinir senha'
      : mode === 'register'
      ? 'Criar Conta'
      : 'Entrar';

  const subtitle =
    mode === 'forgot_request'
      ? 'Informe seu WhatsApp. Enviaremos um código de 6 dígitos para confirmar que o número é seu.'
      : mode === 'forgot_confirm'
      ? 'Digite o código que enviamos no seu WhatsApp e escolha a nova senha.'
      : mode === 'register'
      ? 'Crie sua conta para acessar seu histórico de agendamentos'
      : 'Acesse seu histórico com seu WhatsApp';

  const buttonLabel = isLoading
    ? mode === 'forgot_request'
      ? 'Enviando...'
      : mode === 'forgot_confirm'
      ? 'Redefinindo...'
      : mode === 'register'
      ? 'Criando conta...'
      : 'Entrando...'
    : mode === 'forgot_request'
    ? 'Enviar código'
    : mode === 'forgot_confirm'
    ? 'Redefinir senha'
    : mode === 'register'
    ? 'Criar Conta'
    : 'Entrar';

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl border border-gray-300 shadow-xl">
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">{title}</h2>
      <p className="text-gray-600 text-center mb-6">{subtitle}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div>
            <label className={labelClass}>Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Seu nome completo"
              required
            />
          </div>
        )}

        <div>
          <label className={labelClass}>WhatsApp</label>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(applyPhoneMask(e.target.value))}
            maxLength={15}
            readOnly={mode === 'forgot_confirm'}
            className={`${inputClass} ${mode === 'forgot_confirm' ? 'opacity-70' : ''}`}
            placeholder="(99) 99999-9999"
            required
          />
        </div>

        {mode === 'forgot_confirm' && (
          <div>
            <label className={labelClass}>Código recebido</label>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={`${inputClass} tracking-[0.4em] text-center text-lg font-semibold`}
              placeholder="000000"
              maxLength={6}
              required
            />
          </div>
        )}

        {mode !== 'forgot_request' && (
          <div>
            <label className={labelClass}>
              {mode === 'forgot_confirm' ? 'Nova senha' : 'Senha'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder={mode === 'login' ? 'Sua senha' : `Mínimo ${MIN_PASSWORD} caracteres`}
              minLength={mode === 'login' ? undefined : MIN_PASSWORD}
              required
            />
          </div>
        )}

        {mode === 'forgot_confirm' && (
          <div>
            <label className={labelClass}>Confirmar nova senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              placeholder="Repita a senha"
              minLength={MIN_PASSWORD}
              required
            />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
            {successMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {buttonLabel}
        </button>
      </form>

      <div className="mt-6 text-center space-y-2">
        {mode === 'forgot_request' || mode === 'forgot_confirm' ? (
          <>
            {mode === 'forgot_confirm' && (
              <button
                type="button"
                onClick={() => goTo('forgot_request')}
                className="block w-full text-gray-600 hover:text-gray-800 text-sm font-medium"
              >
                Não recebeu? Enviar outro código
              </button>
            )}
            <button
              type="button"
              onClick={() => goTo('login')}
              className="block w-full text-pink-600 hover:text-pink-700 text-sm font-medium"
            >
              Voltar ao login
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => goTo(mode === 'register' ? 'login' : 'register')}
              className="block w-full text-pink-600 hover:text-pink-700 text-sm font-medium"
            >
              {mode === 'register' ? 'Já tem uma conta? Entrar' : 'Não tem uma conta? Criar conta'}
            </button>
            <button
              type="button"
              onClick={() => goTo('forgot_request')}
              className="block w-full text-gray-600 hover:text-gray-800 text-sm font-medium"
            >
              Esqueci a senha
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ClientLoginPage;
