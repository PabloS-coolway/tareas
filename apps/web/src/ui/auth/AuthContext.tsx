import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Feature, UserDto } from '@yorga/contracts';
import { authGateway } from '../composition';
import { clearToken, getToken, setToken } from '../../infrastructure/session';

interface AuthState {
  user: UserDto | null;
  loading: boolean; // true mientras se restaura la sesión al arrancar
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  /** REQ-006 · ¿el usuario tiene esta feature? Es lo que decide qué ve/usa, en vez del nombre del rol. */
  hasFeature: (feature: Feature) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);

  // Al arrancar, si hay token guardado intentamos recuperar el usuario.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    authGateway
      .me()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const { token, user } = await authGateway.login(email, password);
    setToken(token);
    setUser(user);
  }

  function logout(): void {
    clearToken();
    setUser(null);
  }

  const hasFeature = (feature: Feature): boolean => user?.features?.includes(feature) ?? false;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: user?.role === 'admin', hasFeature }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return ctx;
}
