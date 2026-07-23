import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Admin {
  id: string;
  username: string;
  name: string;
  email?: string;
}

export interface LoginResult {
  ok: boolean;
  /** Mensagem já pronta para exibir quando ok = false. */
  error?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  admin: Admin | null;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // A sessão vive num cookie HttpOnly assinado pelo servidor: quem decide se
  // está autenticado é a API, não o localStorage (que o usuário pode editar).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth', { credentials: 'same-origin' });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && data?.authenticated && data?.admin) {
          setIsAuthenticated(true);
          setAdmin(data.admin as Admin);
        } else {
          setIsAuthenticated(false);
          setAdmin(null);
        }
      } catch {
        if (!cancelled) {
          setIsAuthenticated(false);
          setAdmin(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (username: string, password: string): Promise<LoginResult> => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password }),
      });

      // Uma resposta não-JSON significa que /api/auth não foi executada
      // (404, HTML de erro da plataforma). Isso não é senha errada — dizer que
      // é atrapalha o diagnóstico, então tratamos separadamente.
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text().catch(() => '');
        console.error('[AuthContext] Resposta não-JSON de /api/auth:', {
          status: res.status,
          preview: text?.slice(0, 300),
        });
        return {
          ok: false,
          error:
            res.status === 404
              ? 'A rota /api/auth não respondeu. Em desenvolvimento local use "vercel dev" — o "npm run dev" não executa as funções da pasta api/.'
              : `O servidor respondeu ${res.status} sem JSON. Verifique os logs da aplicação.`,
        };
      }

      const data = await res.json().catch(() => null);
      if (data?.ok && data?.admin) {
        setIsAuthenticated(true);
        setAdmin(data.admin);
        return { ok: true };
      }

      // 401 é credencial inválida de verdade. Qualquer outro status é problema
      // de servidor/configuração e merece a mensagem real.
      const serverError = data?.error;
      console.log('[AuthContext] Login recusado:', { status: res.status, error: serverError });
      return {
        ok: false,
        error:
          res.status === 401
            ? 'Usuário ou senha incorretos. Tente novamente.'
            : serverError || `Falha no login (HTTP ${res.status}).`,
      };
    } catch (error: any) {
      console.error('[AuthContext] Erro durante o login:', error);
      return { ok: false, error: 'Não foi possível contatar o servidor. Verifique sua conexão.' };
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setAdmin(null);
    // Limpa resíduos da versão anterior, que guardava a "sessão" no navegador.
    try {
      localStorage.removeItem('admin_authenticated');
      localStorage.removeItem('admin_data');
    } catch {}
    // O cookie só pode ser apagado pelo servidor (HttpOnly).
    fetch('/api/auth', { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, admin, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
