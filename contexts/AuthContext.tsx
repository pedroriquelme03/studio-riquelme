import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Admin {
  id: string;
  username: string;
  name: string;
  email?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  admin: Admin | null;
  login: (username: string, password: string) => Promise<boolean>;
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

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text().catch(() => '');
        console.error('[AuthContext] Resposta não-JSON de /api/auth:', {
          status: res.status,
          preview: text?.slice(0, 300),
        });
        return false;
      }

      const data = await res.json().catch(() => null);
      if (data?.ok && data?.admin) {
        setIsAuthenticated(true);
        setAdmin(data.admin);
        return true;
      }

      console.log('[AuthContext] Login recusado:', data?.error || 'erro desconhecido');
      return false;
    } catch (error) {
      console.error('[AuthContext] Erro durante o login:', error);
      return false;
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
