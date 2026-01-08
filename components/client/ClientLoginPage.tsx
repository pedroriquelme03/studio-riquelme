import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabaseClient, supabase as supabaseMaybe } from '../../src/lib/supabaseClient';

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

type Step = 'request' | 'verify';

const ClientLoginPage: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<Step>('request');
  const [otp, setOtp] = useState('');
  const navigate = useNavigate();

  // Fallback simples para o endpoint atual caso Supabase não esteja configurado
  const fallbackLogin = async (digits: string) => {
    const res = await fetch('/api/client-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', phone: digits }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data?.error || 'Não foi possível entrar');
    localStorage.setItem('client_phone', digits);
    navigate('/meus-agendamentos');
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const digits = normalizePhone(phone);
      // Tenta usar Supabase, senão cai no fallback
      let supabase = supabaseMaybe || null;
      if (!supabase) {
        supabase = getSupabaseClient();
      }
      const phoneE164 = toE164(digits);
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: phoneE164,
        options: { shouldCreateUser: true },
      });
      if (otpError) {
        // Se falhar por configuração/ambiente, tenta fallback
        if (otpError.message?.toLowerCase().includes('key') || otpError.message?.toLowerCase().includes('url')) {
          await fallbackLogin(digits);
          return;
        }
        throw otpError;
      }
      setStep('verify');
    } catch (err: any) {
      // Se getSupabaseClient lançar erro de env, usa fallback
      if (err?.message?.includes('VITE_SUPABASE_')) {
        try {
          await fallbackLogin(normalizePhone(phone));
          return;
        } catch (fallbackErr: any) {
          setError(fallbackErr?.message || 'Falha no login');
          return;
        }
      }
      setError(err?.message || 'Falha ao enviar código por SMS');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const digits = normalizePhone(phone);
      let supabase = supabaseMaybe || null;
      if (!supabase) {
        supabase = getSupabaseClient();
      }
      const phoneE164 = toE164(digits);
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: phoneE164,
        token: otp.trim(),
        type: 'sms',
      });
      if (verifyError) throw verifyError;
      if (!data?.session) throw new Error('Sessão não criada');
      // Persistir número (compatível com a tela de agendamentos atual)
      localStorage.setItem('client_phone', digits);
      navigate('/meus-agendamentos');
    } catch (err: any) {
      setError(err?.message || 'Código inválido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl border border-gray-300 shadow-xl">
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">Entrar</h2>
      <p className="text-gray-600 text-center mb-6">Acesse seu histórico com seu WhatsApp</p>

      {step === 'request' && (
        <form onSubmit={handleRequestOtp} className="space-y-4">
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
            {isLoading ? 'Enviando SMS...' : 'Enviar código por SMS'}
          </button>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código SMS</label>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900 tracking-widest text-center"
              placeholder="••••••"
              maxLength={6}
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setStep('request'); setOtp(''); }}
              className="w-1/3 bg-white border border-gray-300 text-gray-900 font-semibold py-3 px-6 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={isLoading || otp.length < 4}
              className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Verificando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ClientLoginPage;


