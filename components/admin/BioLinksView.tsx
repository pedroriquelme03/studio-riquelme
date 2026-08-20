import React, { useEffect, useState } from 'react';
import {
  CalendarDaysIcon,
  WhatsAppIcon,
  LocationIcon,
  LinkIcon,
  InstagramIcon,
  PencilIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '../icons';

type BioLink = {
  id: string;
  kind: 'link' | 'header';
  title: string;
  subtitle: string;
  url: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
};

const ICON_OPTIONS: { value: string; label: string }[] = [
  { value: 'calendar', label: 'Agenda / Calendário' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'location', label: 'Endereço / Mapa' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'link', label: 'Link genérico' },
];

const iconPreview = (icon: string) => {
  const cls = 'w-5 h-5';
  switch (icon) {
    case 'calendar': return <CalendarDaysIcon className={cls} />;
    case 'whatsapp': return <WhatsAppIcon className={cls} />;
    case 'location': return <LocationIcon className={cls} />;
    case 'instagram': return <InstagramIcon className={cls} />;
    default: return <LinkIcon className={cls} />;
  }
};

type EditState = {
  id: string | null;
  kind: 'link' | 'header';
  title: string;
  subtitle: string;
  url: string;
  icon: string;
  isActive: boolean;
};

const emptyForm: EditState = {
  id: null,
  kind: 'link',
  title: '',
  subtitle: '',
  url: '',
  icon: 'link',
  isActive: true,
};

const BioLinksView: React.FC = () => {
  const [links, setLinks] = useState<BioLink[]>([]);
  const [headerTitle, setHeaderTitle] = useState('');
  const [headerSubtitle, setHeaderSubtitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<EditState | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bio-links?all=1');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao carregar');
      setLinks(data.links || []);
      setHeaderTitle(data.title || '');
      setHeaderSubtitle(data.subtitle || '');
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const saveHeader = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/bio-links', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'header', title: headerTitle, subtitle: headerSubtitle }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao salvar cabeçalho');
      flash('Cabeçalho salvo');
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar cabeçalho');
    } finally {
      setSaving(false);
    }
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.title.trim()) { setError('Informe o título'); return; }
    setSaving(true);
    setError(null);
    try {
      const isEdit = !!form.id;
      const res = await fetch('/api/bio-links', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id || undefined,
          kind: form.kind,
          title: form.title.trim(),
          subtitle: form.subtitle.trim(),
          url: form.url.trim(),
          icon: form.icon,
          isActive: form.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao salvar');
      setForm(null);
      await load();
      flash(isEdit ? 'Botão atualizado' : 'Botão criado');
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (link: BioLink) => {
    setError(null);
    try {
      const res = await fetch('/api/bio-links', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...link, isActive: !link.isActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao atualizar');
      setLinks(prev => prev.map(l => l.id === link.id ? { ...l, isActive: !l.isActive } : l));
    } catch (e: any) {
      setError(e?.message || 'Erro ao atualizar');
    }
  };

  const removeLink = async (link: BioLink) => {
    if (!confirm(`Remover "${link.title}"?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/bio-links?id=${encodeURIComponent(link.id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao remover');
      setLinks(prev => prev.filter(l => l.id !== link.id));
      flash('Botão removido');
    } catch (e: any) {
      setError(e?.message || 'Erro ao remover');
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= links.length) return;
    const reordered = [...links];
    const [item] = reordered.splice(index, 1);
    reordered.splice(target, 0, item);
    setLinks(reordered); // atualização otimista
    try {
      const res = await fetch('/api/bio-links', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', ids: reordered.map(l => l.id) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao reordenar');
    } catch (e: any) {
      setError(e?.message || 'Erro ao reordenar');
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold gold-text">Página /bio</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Gerencie os botões exibidos em{' '}
            <a href="/bio" target="_blank" rel="noreferrer" className="text-gold hover:underline">/bio</a>.
          </p>
        </div>
        <button
          onClick={() => { setForm({ ...emptyForm }); setError(null); }}
          className="bg-gold hover:brightness-110 text-black font-bold py-2 px-4 rounded-lg self-start"
        >
          + Novo botão
        </button>
      </div>

      {error && <div className="bg-red-950/50 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {message && <div className="bg-emerald-950/50 border border-emerald-800 text-emerald-300 px-4 py-3 rounded-lg text-sm">{message}</div>}

      {/* Cabeçalho da página */}
      <div className="bg-surface-raised p-6 rounded-xl border border-line">
        <h3 className="text-lg font-semibold text-white mb-4">Cabeçalho da página</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-200 mb-1">Título</label>
            <input
              value={headerTitle}
              onChange={(e) => setHeaderTitle(e.target.value)}
              className="w-full bg-surface-overlay border border-line rounded px-3 py-2 text-white"
              placeholder="Studio Riquelme"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-200 mb-1">Descrição</label>
            <input
              value={headerSubtitle}
              onChange={(e) => setHeaderSubtitle(e.target.value)}
              className="w-full bg-surface-overlay border border-line rounded px-3 py-2 text-white"
              placeholder="Beleza, cuidado e estilo em um só lugar."
            />
          </div>
        </div>
        <button
          onClick={saveHeader}
          disabled={saving}
          className="mt-4 bg-gold hover:brightness-110 text-black font-bold py-2 px-4 rounded-lg disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar cabeçalho'}
        </button>
      </div>

      {/* Formulário de criação/edição */}
      {form && (
        <form onSubmit={submitForm} className="bg-surface-raised p-6 rounded-xl border border-gold/40">
          <h3 className="text-lg font-semibold text-white mb-4">
            {form.id ? 'Editar botão' : 'Novo botão'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-200 mb-1">Tipo</label>
              <select
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as 'link' | 'header' })}
                className="w-full bg-surface-overlay border border-line rounded px-3 py-2 text-white"
              >
                <option value="link">Botão (link)</option>
                <option value="header">Título de seção</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-200 mb-1">Título</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-surface-overlay border border-line rounded px-3 py-2 text-white"
                placeholder="Ex.: Agendamento Online"
                required
              />
            </div>
            {form.kind === 'link' && (
              <>
                <div>
                  <label className="block text-sm text-zinc-200 mb-1">Subtítulo (opcional)</label>
                  <input
                    value={form.subtitle}
                    onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                    className="w-full bg-surface-overlay border border-line rounded px-3 py-2 text-white"
                    placeholder="Ex.: Agende pelo nosso sistema"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-200 mb-1">Ícone</label>
                  <select
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    className="w-full bg-surface-overlay border border-line rounded px-3 py-2 text-white"
                  >
                    {ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-zinc-200 mb-1">Link (URL)</label>
                  <input
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    className="w-full bg-surface-overlay border border-line rounded px-3 py-2 text-white"
                    placeholder="https://... ou https://wa.me/5545999999999"
                  />
                  <p className="text-xs text-zinc-400 mt-1">
                    Para WhatsApp use <span className="text-gold">https://wa.me/55DDDNÚMERO</span> (só dígitos).
                  </p>
                </div>
              </>
            )}
          </div>
          <label className="flex items-center gap-2 text-zinc-200 mt-4">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Ativo (visível na página)
          </label>
          <div className="flex gap-3 mt-4">
            <button type="submit" disabled={saving} className="bg-gold hover:brightness-110 text-black font-bold py-2 px-4 rounded-lg disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button type="button" onClick={() => setForm(null)} className="bg-surface-muted text-white py-2 px-4 rounded-lg">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista de botões */}
      <div className="bg-surface-raised rounded-xl border border-line">
        <div className="px-6 py-4 border-b border-line">
          <h3 className="text-lg font-semibold text-white">Botões ({links.length})</h3>
        </div>
        {loading ? (
          <div className="p-6 text-zinc-300">Carregando...</div>
        ) : links.length === 0 ? (
          <div className="p-6 text-zinc-400 text-sm">Nenhum botão cadastrado. Clique em “Novo botão”.</div>
        ) : (
          <ul className="divide-y divide-line">
            {links.map((link, idx) => (
              <li key={link.id} className={`flex items-center gap-3 p-4 ${!link.isActive ? 'opacity-50' : ''}`}>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    title="Mover para cima"
                    className="text-zinc-400 hover:text-gold disabled:opacity-30 disabled:hover:text-zinc-400 rotate-90"
                  >
                    <ChevronLeftIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => move(idx, 1)}
                    disabled={idx === links.length - 1}
                    title="Mover para baixo"
                    className="text-zinc-400 hover:text-gold disabled:opacity-30 disabled:hover:text-zinc-400 rotate-90"
                  >
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                </div>

                {link.kind === 'header' ? (
                  <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-surface-muted text-gold flex items-center justify-center text-xs font-bold uppercase">
                    #
                  </span>
                ) : (
                  <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-gold/10 border border-gold/30 text-gold flex items-center justify-center">
                    {iconPreview(link.icon)}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white truncate">{link.title}</span>
                    {link.kind === 'header' && (
                      <span className="text-[10px] uppercase tracking-wide text-zinc-400 border border-line rounded px-1.5 py-0.5">seção</span>
                    )}
                  </div>
                  {link.kind === 'link' && (
                    <div className="text-sm text-zinc-400 truncate">
                      {link.subtitle && <span>{link.subtitle} · </span>}
                      <span className={link.url ? 'text-zinc-500' : 'text-red-400'}>
                        {link.url || 'sem link'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleActive(link)}
                    title={link.isActive ? 'Desativar' : 'Ativar'}
                    className={`text-xs px-2 py-1 rounded border ${link.isActive ? 'border-emerald-800 text-emerald-300' : 'border-line text-zinc-400'}`}
                  >
                    {link.isActive ? 'Ativo' : 'Inativo'}
                  </button>
                  <button
                    onClick={() => { setForm({ id: link.id, kind: link.kind, title: link.title, subtitle: link.subtitle, url: link.url, icon: link.icon, isActive: link.isActive }); setError(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    title="Editar"
                    className="p-2 text-zinc-300 hover:text-gold"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeLink(link)}
                    title="Remover"
                    className="p-2 text-zinc-300 hover:text-red-400"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default BioLinksView;
