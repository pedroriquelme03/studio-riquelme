import React, { useState, useEffect } from 'react';
import { testSupabaseConnection, SupabaseTestResult } from '@/src/lib/testSupabaseConnection';

const TestSupabaseConnection: React.FC = () => {
  const [result, setResult] = useState<SupabaseTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [tableName, setTableName] = useState<string>('professionals');
  const [envCheck, setEnvCheck] = useState<{
    url: boolean;
    key: boolean;
    urlValue?: string;
    keyPreview?: string;
  } | null>(null);
  const [autoTestDone, setAutoTestDone] = useState(false);

  // Verificar variáveis de ambiente ao carregar
  useEffect(() => {
    const checkEnv = () => {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      setEnvCheck({
        url: !!url,
        key: !!key,
        urlValue: url,
        keyPreview: key ? `${key.substring(0, 20)}...` : undefined,
      });

      // Teste automático após 1 segundo
      if (url && key && !autoTestDone) {
        setTimeout(() => {
          runTest();
          setAutoTestDone(true);
        }, 1000);
      }
    };

    checkEnv();
  }, [autoTestDone]);

  const runTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await testSupabaseConnection(tableName.trim() || 'professionals');
      setResult(res);
    } catch (error: any) {
      setResult({
        ok: false,
        stage: 'env',
        errorCode: 'EXCEPTION',
        errorMessage: error?.message || String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'grid', 
      gap: 16, 
      maxWidth: 800, 
      margin: '0 auto',
      padding: 20,
      background: '#ffffff',
      borderRadius: 12
    }}>
      <h2 style={{ margin: 0, color: '#f9fafb' }}>Teste de Conexão com Supabase</h2>
      
      {/* Verificação de Variáveis de Ambiente */}
      <div style={{
        border: '1px solid #d1d5db',
        borderRadius: 8,
        padding: 16,
        background: '#f9fafb'
      }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#e5e7eb', fontSize: 16 }}>Variáveis de Ambiente</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ 
              width: 12, 
              height: 12, 
              borderRadius: '50%', 
              background: envCheck?.url ? '#10b981' : '#ef4444' 
            }} />
            <span style={{ color: '#9ca3af' }}>
              <strong>VITE_SUPABASE_URL:</strong>{' '}
              {envCheck?.url ? (
                <span style={{ color: '#10b981' }}>
                  ✓ Definida ({envCheck.urlValue?.substring(0, 40)}...)
                </span>
              ) : (
                <span style={{ color: '#ef4444' }}>✗ Não definida</span>
              )}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ 
              width: 12, 
              height: 12, 
              borderRadius: '50%', 
              background: envCheck?.key ? '#10b981' : '#ef4444' 
            }} />
            <span style={{ color: '#9ca3af' }}>
              <strong>VITE_SUPABASE_ANON_KEY:</strong>{' '}
              {envCheck?.key ? (
                <span style={{ color: '#10b981' }}>
                  ✓ Definida ({envCheck.keyPreview})
                </span>
              ) : (
                <span style={{ color: '#ef4444' }}>✗ Não definida</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Controles de Teste */}
      <div style={{ display: 'grid', gap: 8 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ color: '#9ca3af', fontSize: 14 }}>Nome da tabela para testar</span>
          <input
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="professionals"
            style={{
              padding: '8px 12px',
              background: '#ffffff',
              color: '#111827',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 14
            }}
          />
        </label>
        <button 
          onClick={runTest} 
          disabled={loading || !envCheck?.url || !envCheck?.key}
          style={{ 
            padding: '10px 16px',
            background: loading || !envCheck?.url || !envCheck?.key 
              ? '#374151' 
              : '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: loading || !envCheck?.url || !envCheck?.key 
              ? 'not-allowed' 
              : 'pointer',
            fontSize: 14,
            fontWeight: 500
          }}
        >
          {loading ? 'Testando...' : 'Rodar Teste'}
        </button>
      </div>

      {/* Resultado do Teste */}
      {result && (
        <div
          style={{
            border: `1px solid ${result.ok ? '#10b981' : '#ef4444'}`,
            borderRadius: 8,
            padding: 16,
            background: result.ok ? '#052e16' : '#1f1f1f',
            color: result.ok ? '#bbf7d0' : '#fca5a5',
          }}
        >
          <div style={{ 
            fontSize: 18, 
            fontWeight: 'bold', 
            marginBottom: 12,
            color: result.ok ? '#10b981' : '#ef4444'
          }}>
            {result.ok ? '✓ Conexão Bem-Sucedida!' : '✗ Falha na Conexão'}
          </div>
          
          <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
            <div>
              <strong>Etapa:</strong> {result.stage === 'env' ? 'Verificação de Variáveis' : 'Consulta ao Banco'}
            </div>
            
            {!result.ok && (
              <>
                {result.errorCode && (
                  <div>
                    <strong>Código do Erro:</strong> {result.errorCode}
                  </div>
                )}
                {result.httpStatus && (
                  <div>
                    <strong>Status HTTP:</strong> {result.httpStatus}
                  </div>
                )}
                {result.errorMessage && (
                  <div>
                    <strong>Mensagem:</strong> {result.errorMessage}
                  </div>
                )}
                {result.details && (
                  <div>
                    <strong>Detalhes:</strong> {result.details}
                  </div>
                )}
                {result.hint && (
                  <div style={{ 
                    marginTop: 8, 
                    padding: 8, 
                    background: 'rgba(255,255,255,0.1)', 
                    borderRadius: 4 
                  }}>
                    <strong>Dica:</strong> {result.hint}
                  </div>
                )}
              </>
            )}
            
            {result.ok && (
              <div style={{ 
                marginTop: 8, 
                padding: 8, 
                background: 'rgba(16,185,129,0.2)', 
                borderRadius: 4 
              }}>
                A conexão com o Supabase está funcionando corretamente! A tabela "{tableName}" foi acessada com sucesso.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instruções */}
      {(!envCheck?.url || !envCheck?.key) && (
        <div style={{
          border: '1px solid #f59e0b',
          borderRadius: 8,
          padding: 16,
          background: '#1f1f0f',
          color: '#fbbf24'
        }}>
          <strong>⚠️ Atenção:</strong> Configure as variáveis de ambiente no Vercel:
          <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
            <li>VITE_SUPABASE_URL</li>
            <li>VITE_SUPABASE_ANON_KEY</li>
          </ul>
          <div style={{ marginTop: 8, fontSize: 12 }}>
            Após configurar, faça um novo deploy no Vercel.
          </div>
        </div>
      )}
    </div>
  );
};

export default TestSupabaseConnection;


