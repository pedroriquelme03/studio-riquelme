import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

type PlanBenefit = {
  serviceId: number;
  serviceName: string;
  allocated: number;
  used: number;
  reserved: number;
  remaining: number;
  cycleStart: string;
  cycleEnd: string;
};

type ActivePlan = {
  id: string;
  status: string;
  planName: string;
  monthlyPrice: number;
  benefits: string[];
  rulesNotes?: string;
  services: PlanBenefit[];
  subscribedAt?: string;
  lastPaymentAt?: string;
  nextBillingAt?: string;
  cancelledAt?: string;
};

const statusLabel: Record<string, string> = {
  active: 'Ativa',
  awaiting_payment: 'Aguardando pagamento',
  past_due: 'Pagamento pendente',
  payment_failed: 'Pagamento recusado',
  cancelled: 'Cancelada',
  expired: 'Expirada',
};

const ClientMyPlanPage: React.FC = () => {
  const [active, setActive] = useState<ActivePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/client-auth?my_plan=1', { credentials: 'same-origin' });
      if (res.status === 401) {
        navigate('/login-cliente?redirect=/meu-plano');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar plano');
      setActive(data.active || null);
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar plano');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchParams.get('checkout') === 'returned') {
      setInfo('Pagamento em processamento. Seu plano será ativado após a confirmação do gateway.');
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = async () => {
    if (!window.confirm('Deseja cancelar sua assinatura? Esta ação não pode ser desfeita.')) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch('/api/client-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'cancel_subscription' }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Erro ao cancelar');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Erro ao cancelar assinatura');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="text-center text-zinc-300 py-12">Carregando...</div>;

  return (
    <div className="max-w-3xl mx-auto py-6">
      <h1 className="text-3xl font-bold gold-text text-center mb-6">Meu Plano</h1>
      {info && <div className="mb-4 text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-sm">{info}</div>}
      {error && <div className="mb-4 text-red-400 text-center">{error}</div>}

      {!active ? (
        <div className="bg-surface-raised border border-line rounded-xl p-8 text-center">
          <p className="text-zinc-200 mb-6">Você ainda não possui um plano mensal.</p>
          <Link to="/planos-mensais" className="inline-block px-6 py-3 bg-gold text-white font-semibold rounded-lg">
            Conhecer planos
          </Link>
        </div>
      ) : (
        <div className="bg-surface-raised border border-line rounded-xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white">{active.planName}</h2>
              <p className="text-gold text-lg font-semibold mt-1">R$ {active.monthlyPrice.toFixed(2)}/mês</p>
            </div>
            <span className="self-start px-3 py-1 rounded-full text-xs font-semibold bg-surface-overlay border border-line text-zinc-200">
              {statusLabel[active.status] || active.status}
            </span>
          </div>

          {active.benefits?.length > 0 && (
            <div>
              <h3 className="text-white font-semibold mb-2">Benefícios</h3>
              <ul className="list-disc list-inside text-zinc-300 text-sm space-y-1">
                {active.benefits.map((b) => <li key={b}>{b}</li>)}
              </ul>
            </div>
          )}

          {active.services?.length > 0 && (
            <div>
              <h3 className="text-white font-semibold mb-3">Serviços do mês</h3>
              <ul className="space-y-3">
                {active.services.map((s) => (
                  <li key={s.serviceId} className="bg-surface-overlay border border-line rounded-lg p-4 text-sm">
                    <p className="text-white font-medium">{s.serviceName}</p>
                    <p className="text-zinc-400 mt-1">
                      Utilizados: {s.used} · Reservados: {s.reserved} · Restantes: {s.remaining}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-sm text-zinc-400 space-y-1 border-t border-line pt-4">
            {active.nextBillingAt && <p>Próxima cobrança: {new Date(active.nextBillingAt).toLocaleDateString('pt-BR')}</p>}
            {active.lastPaymentAt && <p>Último pagamento: {new Date(active.lastPaymentAt).toLocaleDateString('pt-BR')}</p>}
          </div>

          {active.status === 'active' && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="text-red-400 hover:underline text-sm disabled:opacity-50"
            >
              {cancelling ? 'Cancelando...' : 'Cancelar assinatura'}
            </button>
          )}
        </div>
      )}

      <div className="text-center mt-8 flex flex-col sm:flex-row gap-4 justify-center">
        <Link to="/meus-agendamentos" className="text-gold hover:underline">Meus agendamentos</Link>
        <Link to="/" className="text-gold hover:underline">Novo agendamento</Link>
      </div>
    </div>
  );
};

export default ClientMyPlanPage;
