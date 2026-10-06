import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

type Mode =
  | 'login'
  | 'register'
  | 'forgot_phone'
  | 'forgot_confirm_name'
  | 'forgot_email'
  | 'forgot_sent'
  | 'forgot_reset';

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

  const [mode, setMode] = useState<Mode>(tokenFromUrl ? 'forgot_reset' : 'login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Estado do fluxo "esqueci a senha"
  const [forgotChallenge, setForgotChallenge] = useState('');
  const [forgotDisplayName, setForgotDisplayName] = useState('');
  const [forgotNeedsEmail, setForgotNeedsEmail] = useState(false);
  const [forgotEmailHint, setForgotEmailHint] = useState<string | null>(null);

  const navigate = useNavigate();

  const resetMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const clearForgotState = () => {
    setForgotChallenge('');
    setForgotDisplayName('');
    setForgotNeedsEmail(false);
    setForgotEmailHint(null);
    setEmail('');
    setEmailConfirm('');
  };

  const goTo = (next: Mode) => {
    resetMessages();
    setPassword('');
    setConfirmPassword('');
    if (next === 'register' || next === 'login') {
      setName('');
      clearForgotState();
    }
    if (next === 'forgot_phone') {
      clearForgotState();
      setPhone('');
    }
    if (next !== 'forgot_reset' && tokenFromUrl) {
      navigate('/login-cliente', { replace: true });
    }
    setMode(next);
  };

  const enter = (digits: string) => {
    try {
      if (digits) localStorage.setItem('client_phone', digits);
    } catch {}
    navigate('/meus-agendamentos');
  };

  const sendForgotComplete = async (withEmail: boolean) => {
    const payload: Record<string, unknown> = {
      action: 'forgot_complete',
      challenge: forgotChallenge,
    };
    if (withEmail) {
      payload.email = email.trim().toLowerCase();
      payload.email_confirm = emailConfirm.trim().toLowerCase();
    }
    const { res, data } = await postClientAuth(payload);
    if (!res.ok || !data?.ok) throw new Error(data?.error || 'Não foi possível enviar o e-mail');
    setSuccessMessage(
      data.message ||
        'Enviamos um link de redefinição. Confira sua caixa de entrada e o spam.',
    );
    setForgotEmailHint(data.email_hint || forgotEmailHint);
    setMode('forgot_sent');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setIsLoading(true);

    try {
      if (mode === 'forgot_phone') {
        const digits = normalizePhone(phone);
        if (!digits) {
          setError('Informe o WhatsApp usado no cadastro');
          return;
        }
        const { res, data } = await postClientAuth({
          action: 'forgot_lookup',
          phone: digits,
        });
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'Não encontramos esta conta');
        setForgotChallenge(String(data.challenge || ''));
        setForgotDisplayName(String(data.display_name || 'Cliente'));
        setForgotNeedsEmail(Boolean(data.needs_email));
        setForgotEmailHint(data.email_hint ? String(data.email_hint) : null);
        setMode('forgot_confirm_name');
        return;
      }

      if (mode === 'forgot_email') {
        const mail = email.trim().toLowerCase();
        const mail2 = emailConfirm.trim().toLowerCase();
        if (!mail) {
          setError('Informe um e-mail válido');
          return;
        }
        if (mail !== mail2) {
          setError('Os e-mails não coincidem');
          return;
        }
        await sendForgotComplete(true);
        return;
      }

      if (mode === 'forgot_reset') {
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

  const handleConfirmIdentity = async (isMe: boolean) => {
    resetMessages();
    if (!isMe) {
      goTo('forgot_phone');
      return;
    }
    if (forgotNeedsEmail) {
      setEmail('');
      setEmailConfirm('');
      setMode('forgot_email');
      return;
    }
    setIsLoading(true);
    try {
      await sendForgotComplete(false);
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  const isForgot =
    mode === 'forgot_phone' ||
    mode === 'forgot_confirm_name' ||
    mode === 'forgot_email' ||
    mode === 'forgot_sent' ||
    mode === 'forgot_reset';

  const title = isForgot ? 'Redefinir senha' : mode === 'register' ? 'Criar Conta' : 'Entrar';

  const subtitle =
    mode === 'forgot_phone'
      ? 'Informe o WhatsApp usado no cadastro para localizar sua conta.'
      : mode === 'forgot_confirm_name'
      ? 'Confirme se esta é a sua conta.'
      : mode === 'forgot_email'
      ? 'Sua conta ainda não tem e-mail. Cadastre um para receber o link de redefinição.'
      : mode === 'forgot_sent'
      ? 'Verifique seu e-mail para continuar.'
      : mode === 'forgot_reset'
      ? 'Escolha uma nova senha para acessar sua conta.'
      : mode === 'register'
      ? 'Crie sua conta com WhatsApp e e-mail para acessar seu histórico'
      : 'Entre com WhatsApp ou e-mail e sua senha';

  const buttonLabel = isLoading
    ? mode === 'forgot_phone'
      ? 'Buscando...'
      : mode === 'forgot_email'
      ? 'Enviando...'
      : mode === 'forgot_reset'
      ? 'Redefinindo...'
      : mode === 'register'
      ? 'Criando conta...'
      : 'Entrando...'
    : mode === 'forgot_phone'
    ? 'Continuar'
    : mode === 'forgot_email'
    ? 'Vincular e-mail e enviar link'
    : mode === 'forgot_reset'
    ? 'Redefinir senha'
    : mode === 'register'
    ? 'Criar Conta'
    : 'Entrar';

  const showForm =
    mode === 'login' ||
    mode === 'register' ||
    mode === 'forgot_phone' ||
    mode === 'forgot_email' ||
    mode === 'forgot_reset';

  return (
    <div className="max-w-md mx-auto bg-surface-raised p-8 rounded-2xl border border-line shadow-xl">
      <h2 className="text-2xl font-bold gold-text text-center mb-6">{title}</h2>
      <p className="text-zinc-300 text-center mb-6">{subtitle}</p>

      {mode === 'forgot_confirm_name' && (
        <div className="space-y-4">
          <div className="bg-surface-overlay border border-line rounded-lg p-4 text-center">
            <p className="text-zinc-400 text-sm mb-1">Conta encontrada</p>
            <p className="text-white text-xl font-semibold">{forgotDisplayName}</p>
            {!forgotNeedsEmail && forgotEmailHint && (
              <p className="text-zinc-400 text-sm mt-2">
                O link será enviado para {forgotEmailHint}
              </p>
            )}
            {forgotNeedsEmail && (
              <p className="text-amber-300/90 text-sm mt-2">
                Esta conta ainda não tem e-mail cadastrado.
              </p>
            )}
          </div>
          <p className="text-zinc-300 text-center text-sm">É você?</p>
          {error && (
            <div className="bg-red-950/50 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleConfirmIdentity(false)}
              className="flex-1 bg-surface-overlay border border-line hover:border-zinc-500 text-zinc-200 font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              Não
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleConfirmIdentity(true)}
              className="flex-1 bg-gold hover:brightness-110 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md disabled:opacity-50"
            >
              {isLoading ? 'Enviando...' : 'Sim, sou eu'}
            </button>
          </div>
        </div>
      )}

      {mode === 'forgot_sent' && (
        <div className="space-y-4">
          {successMessage && (
            <div className="bg-emerald-950/50 border border-emerald-800 text-emerald-300 px-4 py-3 rounded-lg text-sm">
              {successMessage}
            </div>
          )}
          {forgotEmailHint && (
            <p className="text-zinc-400 text-center text-sm">
              Destino: {forgotEmailHint}
            </p>
          )}
          <p className="text-zinc-400 text-center text-xs">
            Não encontrou? Confira a pasta de spam ou tente novamente em alguns minutos.
          </p>
        </div>
      )}

      {showForm && (
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

          {(mode === 'register' || mode === 'forgot_phone') && (
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

          {mode === 'register' && (
            <div>
              <label className={labelClass}>E-mail *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />
              <p className="text-xs text-zinc-400 mt-1">Usado para redefinir a senha, se necessário.</p>
            </div>
          )}

          {mode === 'forgot_email' && (
            <>
              <div>
                <label className={labelClass}>E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label className={labelClass}>Confirmar e-mail</label>
                <input
                  type="email"
                  value={emailConfirm}
                  onChange={(e) => setEmailConfirm(e.target.value)}
                  className={inputClass}
                  placeholder="Repita o e-mail"
                  required
                  autoComplete="email"
                />
              </div>
            </>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'forgot_reset') && (
            <div>
              <label className={labelClass}>
                {mode === 'forgot_reset' ? 'Nova senha' : 'Senha'}
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

          {mode === 'forgot_reset' && (
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
      )}

      <div className="mt-6 text-center space-y-2">
        {isForgot ? (
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
              onClick={() => goTo('forgot_phone')}
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
