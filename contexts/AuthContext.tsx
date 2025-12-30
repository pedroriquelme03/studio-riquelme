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

  useEffect(() => {
    // Verificar se há sessão salva no localStorage
    const savedAuth = localStorage.getItem('admin_authenticated');
    const savedAdmin = localStorage.getItem('admin_data');
    
    if (savedAuth === 'true' && savedAdmin) {
      try {
        const adminData = JSON.parse(savedAdmin);
        setIsAuthenticated(true);
        setAdmin(adminData);
      } catch (e) {
        // Se houver erro ao parsear, limpar dados inválidos
        localStorage.removeItem('admin_authenticated');
        localStorage.removeItem('admin_data');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      console.log('[AuthContext] Attempting login for:', username);
      
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      console.log('[AuthContext] Response status:', res.status);

      const data = await res.json();
      console.log('[AuthContext] Response data:', { ok: data.ok, hasAdmin: !!data.admin, error: data.error });

      if (data.ok && data.admin) {
        setIsAuthenticated(true);
        setAdmin(data.admin);
        localStorage.setItem('admin_authenticated', 'true');
        localStorage.setItem('admin_data', JSON.stringify(data.admin));
        console.log('[AuthContext] Login successful');
        return true;
      }
      
      console.log('[AuthContext] Login failed:', data.error || 'Unknown error');
      return false;
    } catch (error) {
      console.error('[AuthContext] Error during login:', error);
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setAdmin(null);
    localStorage.removeItem('admin_authenticated');
    localStorage.removeItem('admin_data');
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

