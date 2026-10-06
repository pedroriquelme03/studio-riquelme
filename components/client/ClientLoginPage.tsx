import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

type Mode = 'login' | 'register' | 'forgot_request' | 'forgot_confirm';

function normalizePhone(phone: string) {
  return (phone || '').replace(/\D/g, '');
}

function applyPhoneMask(value: string): string {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) {
    return numbers.length > 0 ? `(${numbers}` : numbers;
  } else if (numbers.length <= 7) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  } else if (numbers.length <= 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  }
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
}

const MIN_PASSWORD = 8;
const inputClass = 'w-full bg-surface-overlay border border-line rounded-lg p-3 text-white';
const labelClass = 'block text-sm font-medium text-zinc-200 mb-1';

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
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [mode, setMode] = useState<Mode>(tokenFromUrl ? 'forgot_confirm' : 'login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    if (next === 'register' || next === 'login') setName('');
    if (next !== 'forgot_confirm') {
      // Limpa o token da URL ao sair da tela de redefinição.
      if (tokenFromUrl) navigate('/login-cliente', { replace: true });
    }
    setMode(next);
  };

  const enter = (digits: string) => {
    try {
      if (digits) localStorage.setItem('client_phone', digits);
    } catch {}
    navigate('/meus-agendamentos');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setIsLoading(true);

    try {
      if (mode === 'forgot_request') {
        const mail = email.trim().toLowerCase();
        if (!mail) {
          setError('Informe o e-mail da conta');
          return;
        }
        const { res, data } = await postClientAuth({ action: 'request_reset', email: mail });
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'Não foi possível enviar o e-mail');
        setSuccessMessage(
          data.message || 'Se houver uma conta para este e-mail, você receberá um link em instantes.',
        );
        return;
      }

      if (mode === 'forgot_confirm') {
        if (!tokenFromUrl) {
          setError('Link inválido. Solicite uma nova redefinição.');
          return;
        }
        if (password.length < MIN_PASSWORD) {
          setError(`A senha deve ter no mínimo ${MIN_PASSWORD} caracteres`);
          return;
        }
        if (password !== confirmPassword) {
          setError('As senhas não coincidem');
          return;
        }
        const { res, data } = await postClientAuth({
          action: 'reset_password',
          token: tokenFromUrl,
          new_password: password,
        });
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'Não foi possível redefinir a senha');
        enter(String(data.phone || ''));
        return;
      }

      if (mode === 'register') {
        const digits = normalizePhone(phone);
        const mail = email.trim().toLowerCase();
        if (!name.trim()) {
          setError('Nome é obrigatório');
          return;
        }
        if (!mail) {
          setError('E-mail é obrigatório');
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
          email: mail,
          password,
        });
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'Falha ao criar a conta');
        enter(digits);
        return;
      }

      // login
      const id = identifier.trim();
      if (!id) {
        setError('Informe seu WhatsApp ou e-mail');
        return;
      }
      const { res, data } = await postClientAuth({
        action: 'login_password',
        identifier: id,
        password,
      });
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Não foi possível entrar');
      enter(String(data.phone || normalizePhone(id)));
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
      ? 'Informe o e-mail da sua conta. Enviaremos um link para redefinir a senha.'
      : mode === 'forgot_confirm'
      ? 'Escolha uma nova senha para acessar sua conta.'
      : mode === 'register'
      ? 'Crie sua conta com WhatsApp e e-mail para acessar seu histórico'
      : 'Entre com WhatsApp ou e-mail e sua senha';

  const buttonLabel = isLoading
    ? mode === 'forgot_request'
      ? 'Enviando...'
      : mode === 'forgot_confirm'
      ? 'Redefinindo...'
      : mode === 'register'
      ? 'Criando conta...'
      : 'Entrando...'
    : mode === 'forgot_request'
    ? 'Enviar link por e-mail'
    : mode === 'forgot_confirm'
    ? 'Redefinir senha'
    : mode === 'register'
    ? 'Criar Conta'
    : 'Entrar';

  return (
    <div className="max-w-md mx-auto bg-surface-raised p-8 rounded-2xl border border-line shadow-xl">
      <h2 className="text-2xl font-bold gold-text text-center mb-6">{title}</h2>
      <p className="text-zinc-300 text-center mb-6">{subtitle}</p>

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

        {mode === 'login' && (
          <div>
            <label className={labelClass}>WhatsApp ou e-mail</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => {
                const v = e.target.value;
                setIdentifier(v.includes('@') ? v : applyPhoneMask(v));
              }}
              className={inputClass}
              placeholder="(99) 99999-9999 ou seu@email.com"
              required
              autoComplete="username"
            />
          </div>
        )}

        {mode === 'register' && (
          <div>
            <label className={labelClass}>WhatsApp</label>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(applyPhoneMask(e.target.value))}
              maxLength={15}
              className={inputClass}
              placeholder="(99) 99999-9999"
              required
            />
          </div>
        )}

        {(mode === 'register' || mode === 'forgot_request') && (
          <div>
            <label className={labelClass}>E-mail {mode === 'register' ? '*' : ''}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="seu@email.com"
              required
              autoComplete="email"
            />
            {mode === 'register' && (
              <p className="text-xs text-zinc-400 mt-1">Usado para redefinir a senha, se necessário.</p>
            )}
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
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
              autoComplete="new-password"
            />
          </div>
        )}

        {error && (
          <div className="bg-red-950/50 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="bg-emerald-950/50 border border-emerald-800 text-emerald-300 px-4 py-3 rounded-lg text-sm">
            {successMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gold hover:brightness-110 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {buttonLabel}
        </button>
      </form>

      <div className="mt-6 text-center space-y-2">
        {mode === 'forgot_request' || mode === 'forgot_confirm' ? (
          <button
            type="button"
            onClick={() => goTo('login')}
            className="block w-full text-gold hover:text-gold-light text-sm font-medium"
          >
            Voltar ao login
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => goTo(mode === 'register' ? 'login' : 'register')}
              className="block w-full text-gold hover:text-gold-light text-sm font-medium"
            >
              {mode === 'register' ? 'Já tem uma conta? Entrar' : 'Não tem uma conta? Criar conta'}
            </button>
            <button
              type="button"
              onClick={() => goTo('forgot_request')}
              className="block w-full text-zinc-300 hover:text-white text-sm font-medium"
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
