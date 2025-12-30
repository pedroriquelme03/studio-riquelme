import React, { useEffect, useState } from 'react';
import { PlusCircleIcon, TrashIcon, PencilIcon } from '../icons';

type Professional = {
  id: string;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const ProfessionalsView: React.FC = () => {
  const [items, setItems] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editActive, setEditActive] = useState<boolean>(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/professionals');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar profissionais');
      setItems(data.professionals || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/professionals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, is_active: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao cadastrar profissional');
      setName(''); setEmail(''); setPhone('');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (p: Professional) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditEmail(p.email);
    setEditPhone(p.phone);
    setEditActive(p.is_active);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditEmail('');
    setEditPhone('');
    setEditActive(true);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim() || !editEmail.trim() || !editPhone.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/professionals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, name: editName, email: editEmail, phone: editPhone, is_active: editActive })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erro ao atualizar profissional');
      await load();
      cancelEdit();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteProfessional = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este profissional?')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/professionals?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erro ao excluir profissional');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Profissionais</h2>

      <form onSubmit={onSubmit} className="bg-white p-4 rounded-lg border border-gray-300 mb-6 grid md:grid-cols-4 gap-3">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nome"
          className="bg-gray-50 text-gray-900 rounded px-3 py-2 outline-none border border-gray-300 focus:border-pink-600"
        />
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          type="email"
          placeholder="E-mail"
          className="bg-gray-50 text-gray-900 rounded px-3 py-2 outline-none border border-gray-300 focus:border-pink-600"
        />
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="Telefone"
          className="bg-gray-50 text-gray-900 rounded px-3 py-2 outline-none border border-gray-300 focus:border-pink-600"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 disabled:opacity-70"
        >
          <PlusCircleIcon className="w-5 h-5" />
          Adicionar
        </button>
      </form>

      {error && <div className="text-red-400 mb-4">{error}</div>}

      {/* Tabela (desktop) */}
      <div className="hidden md:block bg-white rounded-lg border border-gray-300">
        <table className="w-full text-left table-fixed">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[36%]" />
            <col className="w-[18%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead>
            <tr className="text-gray-700 border-b border-gray-300">
              <th className="p-3 w-[28%]">Nome</th>
              <th className="p-3 w-[36%]">E-mail</th>
              <th className="p-3 w-[18%]">Telefone</th>
              <th className="p-3 w-[10%]">Status</th>
              <th className="p-3 w-[8%] text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map(p => (
              <tr key={p.id} className="border-b border-gray-300/60">
                {editingId === p.id ? (
                  <>
                    <td className="p-3 w-[28%]">
                      <input value={editName} onChange={e => setEditName(e.target.value)} className="bg-gray-50 text-gray-900 rounded px-2 py-1 border border-gray-300 w-full" />
                    </td>
                    <td className="p-3 w-[36%]">
                      <input value={editEmail} onChange={e => setEditEmail(e.target.value)} className="bg-gray-50 text-gray-900 rounded px-2 py-1 border border-gray-300 w-full" />
                    </td>
                    <td className="p-3 w-[18%]">
                      <input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="bg-gray-50 text-gray-900 rounded px-2 py-1 border border-gray-300 w-full" />
                    </td>
                    <td className="p-3 w-[10%]">
                      <label className="inline-flex items-center gap-2 text-gray-700">
                        <input type="checkbox" checked={editActive} onChange={e => setEditActive(e.target.checked)} />
                        Ativo
                      </label>
                    </td>
                    <td className="p-3 w-[8%]">
                      <div className="w-full flex items-center justify-end gap-2">
                        <button onClick={saveEdit} className="bg-emerald-500 hover:bg-emerald-400 text-gray-900 font-semibold px-3 py-1 rounded">Salvar</button>
                        <button onClick={cancelEdit} className="bg-gray-600 hover:bg-gray-500 text-gray-900 font-semibold px-3 py-1 rounded">Cancelar</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-3 w-[28%] text-gray-900">
                      <div className="min-w-0 truncate">{p.name}</div>
                    </td>
                    <td className="p-3 w-[36%] text-gray-700">
                      <div className="min-w-0 max-w-[220px] truncate">{p.email}</div>
                    </td>
                    <td className="p-3 w-[18%] text-gray-700 whitespace-nowrap">{p.phone}</td>
                    <td className="p-3 w-[10%]">
                      <span className={p.is_active ? 'text-emerald-400' : 'text-gray-600'}>
                        {p.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="p-3 w-[8%]">
                      <div className="w-full flex items-center justify-end gap-3">
                        <button onClick={() => startEdit(p)} className="text-gray-700 hover:text-blue-400 align-middle"><PencilIcon className="w-5 h-5 inline" /></button>
                        <button onClick={() => deleteProfessional(p.id)} className="text-gray-700 hover:text-red-400 align-middle"><TrashIcon className="w-5 h-5 inline" /></button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td className="p-4 text-gray-600" colSpan={5}>Nenhum profissional cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cards (mobile) */}
      <div className="md:hidden grid gap-3">
        {items.map(p => (
          <div key={p.id} className="bg-white rounded-lg border border-gray-300 p-4">
            {editingId === p.id ? (
              <div className="grid gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Nome</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="bg-gray-50 text-gray-900 rounded px-3 py-2 border border-gray-300 w-full" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">E-mail</label>
                  <input value={editEmail} onChange={e => setEditEmail(e.target.value)} className="bg-gray-50 text-gray-900 rounded px-3 py-2 border border-gray-300 w-full" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Telefone</label>
                  <input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="bg-gray-50 text-gray-900 rounded px-3 py-2 border border-gray-300 w-full" />
                </div>
                <label className="inline-flex items-center gap-2 text-gray-700">
                  <input type="checkbox" checked={editActive} onChange={e => setEditActive(e.target.checked)} />
                  Ativo
                </label>
                <div className="flex justify-end gap-2">
                  <button onClick={saveEdit} className="bg-emerald-500 hover:bg-emerald-400 text-gray-900 font-semibold px-4 py-2 rounded">Salvar</button>
                  <button onClick={cancelEdit} className="bg-gray-600 hover:bg-gray-500 text-gray-900 font-semibold px-4 py-2 rounded">Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <div className="text-gray-900 font-semibold truncate">{p.name}</div>
                    <div className="text-gray-700 truncate">{p.email}</div>
                    <div className="text-gray-700">{p.phone}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => startEdit(p)} className="text-gray-700 hover:text-blue-400"><PencilIcon className="w-5 h-5" /></button>
                    <button onClick={() => deleteProfessional(p.id)} className="text-gray-700 hover:text-red-400"><TrashIcon className="w-5 h-5" /></button>
                  </div>
                </div>
                <div className="text-sm">
                  <span className={p.is_active ? 'text-emerald-400' : 'text-gray-600'}>
                    {p.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProfessionalsView;

