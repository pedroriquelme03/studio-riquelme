import React, { useEffect, useState } from 'react';
import { MonthlyPlan, MonthlyPlanService } from '../../types';

type ServiceOption = { id: number; name: string };

const emptyServiceRow = (): MonthlyPlanService => ({
  serviceId: 0,
  serviceName: '',
  quantityPerMonth: 1,
  sortOrder: 0,
});

const MonthlyPlansView: React.FC = () => {
  const [plans, setPlans] = useState<MonthlyPlan[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [benefitsText, setBenefitsText] = useState('');
  const [rulesNotes, setRulesNotes] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [planServices, setPlanServices] = useState<MonthlyPlanService[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansRes, svcRes] = await Promise.all([
        fetch('/api/services?monthly_plans=1'),
        fetch('/api/services'),
      ]);
      const [plansData, svcData] = await Promise.all([plansRes.json(), svcRes.json()]);
      if (!plansRes.ok) throw new Error(plansData?.error || 'Erro ao carregar planos');
      setPlans((plansData.plans || []) as MonthlyPlan[]);
      if (svcRes.ok) {
        setServices((svcData.services || []).map((s: any) => ({ id: s.id, name: s.name })));
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setMonthlyPrice('');
    setImageUrl('');
    setBenefitsText('');
    setRulesNotes('');
    setDisplayOrder('0');
    setIsFeatured(false);
    setIsActive(true);
    setPlanServices([]);
    setShowForm(false);
  };

  const openEdit = (plan: MonthlyPlan) => {
    setEditingId(plan.id);
    setName(plan.name);
    setDescription(plan.description);
    setMonthlyPrice(String(plan.monthlyPrice));
    setImageUrl(plan.imageUrl || '');
    setBenefitsText((plan.benefits || []).join('\n'));
    setRulesNotes(plan.rulesNotes || '');
    setDisplayOrder(String(plan.displayOrder ?? 0));
    setIsFeatured(Boolean(plan.isFeatured));
    setIsActive(plan.isActive !== false);
    setPlanServices(plan.services?.length ? plan.services.map((s) => ({ ...s })) : []);
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        type: 'monthly_plan',
        id: editingId || undefined,
        name,
        description,
        monthlyPrice: Number(monthlyPrice),
        imageUrl: imageUrl || null,
        benefits: benefitsText.split('\n').map((l) => l.trim()).filter(Boolean),
        rulesNotes,
        displayOrder: Number(displayOrder || 0),
        isFeatured,
        isActive,
        services: planServices
          .filter((s) => s.serviceId > 0 && s.quantityPerMonth > 0)
          .map((s, idx) => ({
            serviceId: s.serviceId,
            quantityPerMonth: s.quantityPerMonth,
            sortOrder: idx,
          })),
      };
      const res = await fetch('/api/services', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao salvar plano');
      await load();
      resetForm();
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Excluir este plano?')) return;
    try {
      const res = await fetch(`/api/services?monthly_plan_id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao excluir');
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao excluir');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold gold-text text-center mb-6">Planos Mensais</h2>
      {error && <div className="text-red-400 mb-4">{error}</div>}

      <div className="flex justify-center mb-6">
        <button
          type="button"
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-gold text-white font-bold py-2 px-4 rounded-lg"
        >
          Novo plano
        </button>
      </div>

      {showForm && (
        <div className="bg-surface-raised border border-line rounded-xl p-6 mb-8 space-y-4">
          <h3 className="text-lg font-bold text-white">{editingId ? 'Editar plano' : 'Novo plano'}</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <input className="w-full bg-surface-overlay border border-line rounded-lg p-3" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="w-full bg-surface-overlay border border-line rounded-lg p-3" placeholder="Valor mensal (R$)" type="number" min="0.01" step="0.01" value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} />
            <input className="w-full bg-surface-overlay border border-line rounded-lg p-3 md:col-span-2" placeholder="URL da imagem (opcional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            <input className="w-full bg-surface-overlay border border-line rounded-lg p-3" placeholder="Ordem de exibição" type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} />
          </div>
          <textarea className="w-full bg-surface-overlay border border-line rounded-lg p-3" rows={2} placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />
          <textarea className="w-full bg-surface-overlay border border-line rounded-lg p-3" rows={4} placeholder="Benefícios (um por linha)" value={benefitsText} onChange={(e) => setBenefitsText(e.target.value)} />
          <textarea className="w-full bg-surface-overlay border border-line rounded-lg p-3" rows={2} placeholder="Regras / observações" value={rulesNotes} onChange={(e) => setRulesNotes(e.target.value)} />

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white font-semibold">Serviços incluídos</p>
              <button type="button" onClick={() => setPlanServices((p) => [...p, emptyServiceRow()])} className="text-gold text-sm">+ Adicionar serviço</button>
            </div>
            {planServices.map((row, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                <select
                  className="bg-surface-overlay border border-line rounded-lg p-2"
                  value={row.serviceId || ''}
                  onChange={(e) => {
                    const serviceId = Number(e.target.value);
                    const serviceName = services.find((s) => s.id === serviceId)?.name || '';
                    setPlanServices((prev) => prev.map((r, i) => i === idx ? { ...r, serviceId, serviceName } : r));
                  }}
                >
                  <option value="">Serviço</option>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input
                  type="number"
                  min="1"
                  className="bg-surface-overlay border border-line rounded-lg p-2"
                  placeholder="Qtd/mês"
                  value={row.quantityPerMonth}
                  onChange={(e) => setPlanServices((prev) => prev.map((r, i) => i === idx ? { ...r, quantityPerMonth: Number(e.target.value) } : r))}
                />
                <button type="button" onClick={() => setPlanServices((prev) => prev.filter((_, i) => i !== idx))} className="text-red-400 text-sm">Remover</button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-zinc-200">
            <label className="flex items-center gap-2"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Ativo</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} /> Destaque</label>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={save} disabled={saving} className="bg-gold text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button type="button" onClick={resetForm} className="text-zinc-300">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-center text-zinc-300">Carregando...</p> : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-surface-raised border border-line rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="font-bold text-white">{plan.name} {plan.isFeatured && <span className="text-gold text-xs">★ Destaque</span>}</p>
                <p className="text-gold">R$ {plan.monthlyPrice.toFixed(2)}/mês</p>
                <p className="text-sm text-zinc-400">{plan.isActive ? 'Ativo' : 'Inativo'} · Ordem {plan.displayOrder ?? 0}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => openEdit(plan)} className="px-3 py-2 bg-surface-overlay border border-line rounded-lg text-sm">Editar</button>
                <button type="button" onClick={() => remove(plan.id)} className="px-3 py-2 text-red-400 text-sm">Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MonthlyPlansView;
