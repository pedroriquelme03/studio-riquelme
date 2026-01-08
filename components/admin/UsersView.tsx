import React, { useEffect, useMemo, useState } from 'react';
import { supabase, getSupabaseClient } from '../../src/lib/supabaseClient';

type AdminRow = {
  id: string;
  username: string;
  name: string;
  email?: string | null;
  is_active: boolean;
  created_at?: string;
  last_login?: string | null;
};

const UsersView: React.FC = () => {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdMsg, setCreatedMsg] = useState<string | null>(null);

  const canLoadFromSupabase = useMemo(() => {
    try {
      return Boolean(supabase || getSupabaseClient());
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (!canLoadFromSupabase) return;
      setLoading(true);
      setError(null);
      try {
        const cli = supabase || getSupabaseClient();
        const { data, error } = await cli
          .from('admins')
          .select('id, username, name, email, is_active, created_at, last_login')
          .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        setRows((data || []) as AdminRow[]);
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar usuários');
      } finally {
        setLoading(false);
      }
    })();
  }, [canLoadFromSupabase]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreatedMsg(null);
    setCreating(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password,
          name: name.trim(),
          email: email.trim() || undefined,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Falha na criação');
      }
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Falha ao criar usuário');
      }
      setCreatedMsg('Usuário criado com sucesso');
      setUsername('');
      setPassword('');
      setName('');
      setEmail('');
      // Recarregar lista se possível
      if (canLoadFromSupabase) {
        try {
          const cli = supabase || getSupabaseClient();
          const { data: list } = await cli
            .from('admins')
            .select('id, username, name, email, is_active, created_at, last_login')
            .order('created_at', { ascending: false });
          setRows((list || []) as AdminRow[]);
        } catch {}
      }
    } catch (e: any) {
      setError(e?.message || 'Erro ao criar usuário');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-300 shadow-sm">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Usuários do Painel</h2>

      <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2 mb-8">
        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900"
            placeholder="ex.: gerente01"
            required
          />
        </div>
        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900"
            placeholder="Nome completo"
            required
          />
        </div>
        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Email (opcional)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900"
            placeholder="email@exemplo.com"
          />
        </div>
        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900"
            placeholder="Defina uma senha segura"
            required
            minLength={6}
          />
        </div>
        <div className="md:col-span-2 flex gap-3">
          <button
            type="submit"
            disabled={creating}
            className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Criando...' : 'Criar usuário'}
          </button>
          {createdMsg && <div className="text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{createdMsg}</div>}
          {error && <div className="text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        </div>
      </form>

      <div className="space-y-2">
        <div className="text-sm text-gray-600 mb-2">Lista de usuários</div>
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ativo</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Último login</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-sm text-gray-500">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-sm text-gray-500">
                    Carregando...
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-sm text-gray-900">{r.username}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{r.name}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{r.email || '-'}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${r.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {r.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">
                    {r.last_login ? new Date(r.last_login).toLocaleString('pt-BR') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UsersView;

