import { createClient } from '@supabase/supabase-js';

export type SupabaseTestStage = 'env' | 'query';

export interface SupabaseTestResult {
  ok: boolean;
  stage: SupabaseTestStage;
  errorCode?: string;
  errorMessage?: string;
  httpStatus?: number;
  details?: string;
  hint?: string;
}

export async function testSupabaseConnection(tableName: string = 'professionals'): Promise<SupabaseTestResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      stage: 'env',
      errorCode: 'ENV_MISSING',
      errorMessage: 'VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não estão definidas.',
    };
  }

  try {
    // Criar cliente diretamente para o teste
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const { error, status } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      return {
        ok: false,
        stage: 'query',
        errorCode: (error as any)?.code ?? 'POSTGREST_ERROR',
        errorMessage: error.message,
        httpStatus: status,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
      };
    }

    return { ok: true, stage: 'query' };
  } catch (e: any) {
    return {
      ok: false,
      stage: 'query',
      errorCode: e?.code ?? 'EXCEPTION',
      errorMessage: e?.message ?? String(e),
    };
  }
}


