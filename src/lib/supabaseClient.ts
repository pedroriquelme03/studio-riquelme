import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Criar cliente apenas se as variáveis estiverem definidas
// Isso evita que o app quebre na inicialização
let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('Erro ao criar cliente Supabase:', error);
  }
} else {
  console.warn('Variáveis de ambiente do Supabase não estão definidas. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
}

// Exportar o cliente ou lançar erro apenas quando for usado
export const getSupabaseClient = (): SupabaseClient => {
  if (!supabase) {
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL não está definida no ambiente.');
    }
    if (!supabaseAnonKey) {
      throw new Error('VITE_SUPABASE_ANON_KEY não está definida no ambiente.');
    }
    throw new Error('Cliente Supabase não foi inicializado.');
  }
  return supabase;
};

// Exportar diretamente para compatibilidade com código existente
// Mas agora é seguro - retorna null se não estiver configurado
export { supabase };


