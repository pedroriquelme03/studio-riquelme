import React, { useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabaseClient';

type ProfileRow = { [key: string]: unknown };

const ProfilesList: React.FC = () => {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabase) {
        throw new Error('Cliente Supabase não está configurado. Verifique as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
      }
      const { data, error: supaError } = await supabase
        .from('profiles')
        .select('*');
      if (supaError) throw supaError;
      setProfiles(data ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Erro ao carregar profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  if (loading) return <div>Carregando profiles...</div>;
  if (error) return <div style={{ color: '#f87171' }}>Erro: {error}</div>;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Profiles</h2>
        <button onClick={fetchProfiles} style={{ padding: '6px 10px' }}>
          Recarregar
        </button>
      </div>
      {profiles.length === 0 ? (
        <div>Nenhum registro encontrado.</div>
      ) : (
        <ul style={{ display: 'grid', gap: 8, padding: 0, listStyle: 'none' }}>
          {profiles.map((row, idx) => (
            <li
              key={String((row as any).id ?? idx)}
              style={{
                border: '1px solid #374151',
                borderRadius: 8,
                padding: 12,
                background: '#111827',
                color: '#e5e7eb',
              }}
            >
              <pre
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {JSON.stringify(row, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ProfilesList;


