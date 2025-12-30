import React, { useState } from 'react';
import { testSupabaseConnection, SupabaseTestResult } from '@/src/lib/testSupabaseConnection';

const TestSupabaseConnection: React.FC = () => {
  const [result, setResult] = useState<SupabaseTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [tableName, setTableName] = useState<string>('professionals');

  const runTest = async () => {
    setLoading(true);
    const res = await testSupabaseConnection(tableName.trim() || 'professionals');
    setResult(res);
    setLoading(false);
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>Teste de Conexão com Supabase</h2>
      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ color: '#9ca3af' }}>Nome da tabela</span>
        <input
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          placeholder="professionals"
          style={{
            padding: '6px 10px',
            background: '#111827',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderRadius: 6
          }}
        />
      </label>
      <button onClick={runTest} disabled={loading} style={{ padding: '6px 10px' }}>
        {loading ? 'Testando...' : 'Rodar teste'}
      </button>
      {result && (
        <div
          style={{
            border: '1px solid #374151',
            borderRadius: 8,
            padding: 12,
            background: result.ok ? '#052e16' : '#111827',
            color: result.ok ? '#bbf7d0' : '#e5e7eb',
          }}
        >
          <div><strong>Status:</strong> {result.ok ? 'OK' : 'FALHA'}</div>
          <div><strong>Etapa:</strong> {result.stage}</div>
          {!result.ok && (
            <>
              <div><strong>Código:</strong> {result.errorCode ?? '-'}</div>
              <div><strong>HTTP:</strong> {result.httpStatus ?? '-'}</div>
              <div><strong>Mensagem:</strong> {result.errorMessage ?? '-'}</div>
              {result.details && <div><strong>Detalhes:</strong> {result.details}</div>}
              {result.hint && <div><strong>Dica:</strong> {result.hint}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TestSupabaseConnection;


