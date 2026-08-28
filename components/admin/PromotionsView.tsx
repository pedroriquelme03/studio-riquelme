import React, { useEffect, useMemo, useState } from 'react';
import { Promotion, PromotionItem } from '../../types';

type ServiceOption = { id: number; name: string; duration: number; price: number };
type ProfessionalOption = { id: string; name: string };

const emptyItem = (order: number): PromotionItem => ({
  serviceId: 0,
  professionalId: '',
  sortOrder: order,
  pricePercent: 0,
});

const PromotionsView: React.FC = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<'fixed' | 'temporary'>('temporary');
  const [totalPrice, setTotalPrice] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [gapMinutes, setGapMinutes] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [items, setItems] = useState<PromotionItem[]>([emptyItem(1)]);
  const [saving, setSaving] = useState(false);

  const percentSum = useMemo(() => items.reduce((s, i) => s + Number(i.pricePercent || 0), 0), [items]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [promoRes, svcRes, profRes] = await Promise.all([
        fetch('/api/services?promotions=1'),
        fetch('/api/services'),
        fetch('/api/professionals'),
      ]);
      const [promoData, svcData, profData] = await Promise.all([promoRes.json(), svcRes.json(), profRes.json()]);
      if (!promoRes.ok) throw new Error(promoData?.error || 'Erro ao carregar promoções');
      setPromotions((promoData.promotions || []) as Promotion[]);
      if (svcRes.ok) {
        setServices((svcData.services || []).map((s: any) => ({
          id: s.id, name: s.name, duration: s.duration, price: s.price,
        })));
      }
      if (profRes.ok) {
        setProfessionals((profData.professionals || []).map((p: any) => ({ id: p.id, name: p.name })));
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
    setKind('temporary');
    setTotalPrice('');
    setValidFrom('');
    setValidUntil('');
    setGapMinutes('0');
    setIsActive(true);
    setItems([emptyItem(1)]);
    setShowForm(false);
  };

  const openEdit = (promo: Promotion) => {
    setEditingId(promo.id);
    setName(promo.name);
    setDescription(promo.description || '');
    setKind(promo.kind);
    setTotalPrice(String(promo.totalPrice));
    setValidFrom(promo.validFrom || '');
    setValidUntil(promo.validUntil || '');
    setGapMinutes(String(promo.gapMinutes || 0));
    setIsActive(promo.isActive);
    setItems(promo.items.length ? promo.items.map((i) => ({ ...i })) : [emptyItem(1)]);
    setShowForm(true);
  };

  const updateItem = (index: number, patch: Partial<PromotionItem>) => {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const moveItem = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next.map((row, i) => ({ ...row, sortOrder: i + 1 })));
  };

  const addItem = () => {
    setItems((prev) => [...prev, emptyItem(prev.length + 1)]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index).map((row, i) => ({ ...row, sortOrder: i + 1 })));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        type: 'promotion',
        id: editingId || undefined,
        name: name.trim(),
        description: description.trim(),
        kind,
        totalPrice: Number(totalPrice),
        validFrom: kind === 'temporary' ? validFrom || null : null,
        validUntil: kind === 'temporary' ? validUntil || null : null,
        gapMinutes: Number(gapMinutes || 0),
        isActive,
        items: items.map((item) => ({
          service_id: item.serviceId,
          professional_id: item.professionalId,
          sort_order: item.sortOrder,
          price_percent: item.pricePercent,
        })),
      };
      const res = await fetch('/api/services', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao salvar promoção');
      resetForm();
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta promoção?')) return;
    setError(null);
    try {
      const res = await fetch(`/api/services?promotion_id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao excluir');
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao excluir');
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold gold-text">Promoções</h2>
        <button
          type="button"
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 bg-gold text-white font-semibold rounded"
        >
          Nova promoção
        </button>
      </div>

      {error && <div className="text-red-400 mb-4">{error}</div>}
      {loading && <div className="text-zinc-300 mb-4">Carregando...</div>}

      {showForm && (
        <form onSubmit={save} className="bg-surface-raised border border-line rounded-lg p-4 mb-6 space-y-4">
          <h3 className="text-white font-semibold">{editingId ? 'Editar promoção' : 'Nova promoção'}</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-300 mb-1">Nome</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-surface-overlay border border-line rounded px-3 py-2 text-white" required />
            </div>
            <div>
              <label className="block text-xs text-zinc-300 mb-1">Valor total (R$)</label>
              <input type="number" min="0.01" step="0.01" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} className="w-full bg-surface-overlay border border-line rounded px-3 py-2 text-white" required />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-zinc-300 mb-1">Descrição</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full bg-surface-overlay border border-line rounded px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-xs text-zinc-300 mb-1">Tipo</label>
              <select value={kind} onChange={(e) => setKind(e.target.value as 'fixed' | 'temporary')} className="w-full bg-surface-overlay border border-line rounded px-3 py-2 text-white">
                <option value="fixed">Fixa (sem prazo)</option>
                <option value="temporary">Temporária (com validade)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-300 mb-1">Intervalo entre serviços (min)</label>
              <input type="number" min="0" step="1" value={gapMinutes} onChange={(e) => setGapMinutes(e.target.value)} className="w-full bg-surface-overlay border border-line rounded px-3 py-2 text-white" />
            </div>
            {kind === 'temporary' && (
              <>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Válida de</label>
                  <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="w-full bg-surface-overlay border border-line rounded px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Válida até</label>
                  <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full bg-surface-overlay border border-line rounded px-3 py-2 text-white" />
                </div>
              </>
            )}
            <div className="flex items-center gap-2 pt-6">
              <input id="promo-active" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <label htmlFor="promo-active" className="text-sm text-zinc-300">Ativa</label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-white font-medium">Sequência de serviços</h4>
              <button type="button" onClick={addItem} className="text-gold text-sm hover:underline">+ Adicionar serviço</button>
            </div>
            <p className={`text-xs mb-3 ${Math.abs(percentSum - 100) < 0.01 ? 'text-emerald-400' : 'text-amber-400'}`}>
              Soma das porcentagens: {percentSum.toFixed(2)}% (deve ser 100%)
            </p>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="grid md:grid-cols-6 gap-2 items-end bg-surface-overlay p-3 rounded border border-line">
                  <div className="text-zinc-400 text-sm font-semibold">#{item.sortOrder}</div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-zinc-400 mb-1">Serviço</label>
                    <select value={item.serviceId || ''} onChange={(e) => updateItem(index, { serviceId: Number(e.target.value) })} className="w-full bg-surface-raised border border-line rounded px-2 py-2 text-white text-sm" required>
                      <option value="">Selecione</option>
                      {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-zinc-400 mb-1">Profissional</label>
                    <select value={item.professionalId} onChange={(e) => updateItem(index, { professionalId: e.target.value })} className="w-full bg-surface-raised border border-line rounded px-2 py-2 text-white text-sm" required>
                      <option value="">Selecione</option>
                      {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">%</label>
                    <input type="number" min="0.01" max="100" step="0.01" value={item.pricePercent || ''} onChange={(e) => updateItem(index, { pricePercent: Number(e.target.value) })} className="w-full bg-surface-raised border border-line rounded px-2 py-2 text-white text-sm" required />
                  </div>
                  <div className="flex gap-1 justify-end md:col-span-6">
                    <button type="button" onClick={() => moveItem(index, -1)} className="text-xs px-2 py-1 border border-line rounded text-zinc-300">↑</button>
                    <button type="button" onClick={() => moveItem(index, 1)} className="text-xs px-2 py-1 border border-line rounded text-zinc-300">↓</button>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(index)} className="text-xs px-2 py-1 text-red-400">Remover</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={resetForm} className="px-4 py-2 border border-line rounded text-white">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-gold text-white font-semibold rounded disabled:opacity-50">
              {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4">
        {promotions.length === 0 && !loading && (
          <p className="text-zinc-400 text-center py-8">Nenhuma promoção cadastrada.</p>
        )}
        {promotions.map((promo) => (
          <div key={promo.id} className="bg-surface-raised border border-line rounded-lg p-4">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">{promo.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-surface-overlay text-zinc-300">{promo.kind === 'fixed' ? 'Fixa' : 'Temporária'}</span>
                  {!promo.isActive && <span className="text-xs text-zinc-500">Inativa</span>}
                </div>
                {promo.description && <p className="text-sm text-zinc-400 mt-1">{promo.description}</p>}
                <p className="text-gold font-bold mt-2">R$ {promo.totalPrice.toFixed(2)}</p>
                {promo.kind === 'temporary' && (promo.validFrom || promo.validUntil) && (
                  <p className="text-xs text-zinc-500 mt-1">
                    {promo.validFrom ? new Date(promo.validFrom + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                    {' → '}
                    {promo.validUntil ? new Date(promo.validUntil + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                  </p>
                )}
                <ol className="mt-3 space-y-1 text-sm text-zinc-300 list-decimal list-inside">
                  {promo.items.map((item) => (
                    <li key={item.sortOrder}>
                      {item.serviceName || `Serviço #${item.serviceId}`} — {item.professionalName || 'Profissional'} ({item.pricePercent}%)
                    </li>
                  ))}
                </ol>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(promo)} className="px-3 py-2 text-gold border border-line rounded">Editar</button>
                <button onClick={() => remove(promo.id)} className="px-3 py-2 text-red-400 border border-line rounded">Excluir</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PromotionsView;
