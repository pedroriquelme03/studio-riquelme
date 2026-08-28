import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MonthlyPlan } from '../types';

const MonthlyPlansPage: React.FC = () => {
  const [plans, setPlans] = useState<MonthlyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/services?monthly_plans=1');
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Erro ao carregar planos');
        setPlans((data.plans || []) as MonthlyPlan[]);
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar planos');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSubscribe = async (planId: string) => {
    setSubscribingId(planId);
    setError(null);
    try {
      const authRes = await fetch('/api/client-auth', { credentials: 'same-origin' });
      const authData = await authRes.json();
      if (!authData?.authenticated) {
        navigate(`/login-cliente?redirect=${encodeURIComponent('/planos-mensais')}`);
        return;
      }

      const res = await fetch('/api/client-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'subscribe_plan', plan_id: planId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Não foi possível iniciar a assinatura');

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      throw new Error('URL de pagamento não retornada');
    } catch (e: any) {
      setError(e?.message || 'Erro ao assinar plano');
    } finally {
      setSubscribingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold gold-text mb-2">Planos Mensais</h1>
        <p className="text-zinc-300">Escolha o plano ideal e assine com cartão de crédito de forma segura.</p>
      </div>

      {error && <div className="mb-4 text-red-400 text-center">{error}</div>}
      {loading && <div className="text-center text-zinc-300">Carregando planos...</div>}

      {!loading && plans.length === 0 && (
        <div className="text-center text-zinc-400 bg-surface-raised border border-line rounded-lg p-8">
          Nenhum plano disponível no momento.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-surface-raised border rounded-2xl p-6 shadow-lg flex flex-col ${
              plan.isFeatured ? 'border-gold' : 'border-line'
            }`}
          >
            {plan.isFeatured && (
              <span className="self-start text-xs font-semibold uppercase tracking-wide text-gold mb-3">Destaque</span>
            )}
            {plan.imageUrl && (
              <img src={plan.imageUrl} alt={plan.name} className="w-16 h-16 object-cover rounded-lg mb-4" />
            )}
            <h2 className="text-2xl font-bold text-white">{plan.name}</h2>
            <p className="text-gold text-xl font-bold mt-2">
              R$ {plan.monthlyPrice.toFixed(2)}<span className="text-sm text-zinc-400 font-normal">/mês</span>
            </p>
            <p className="text-zinc-300 text-sm mt-3">{plan.description}</p>

            {plan.benefits?.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-white mb-2">Inclui:</p>
                <ul className="space-y-1 text-sm text-zinc-300 list-disc list-inside">
                  {plan.benefits.map((b) => <li key={b}>{b}</li>)}
                </ul>
              </div>
            )}

            {plan.services?.length > 0 && (
              <div className="mt-4 text-sm text-zinc-300 space-y-1">
                {plan.services.map((s) => (
                  <p key={s.serviceId}>
                    {s.quantityPerMonth}x {s.serviceName} por mês
                  </p>
                ))}
              </div>
            )}

            {plan.rulesNotes && (
              <p className="mt-4 text-xs text-zinc-500 border-t border-line pt-3">{plan.rulesNotes}</p>
            )}

            <button
              type="button"
              onClick={() => handleSubscribe(plan.id)}
              disabled={subscribingId === plan.id}
              className="mt-6 w-full py-3 bg-gold hover:brightness-110 text-white font-bold rounded-lg disabled:opacity-50"
            >
              {subscribingId === plan.id ? 'Redirecionando...' : 'Assinar plano'}
            </button>
          </div>
        ))}
      </div>

      <div className="text-center mt-8">
        <Link to="/" className="text-gold hover:underline">Voltar ao agendamento</Link>
      </div>
    </div>
  );
};

export default MonthlyPlansPage;
