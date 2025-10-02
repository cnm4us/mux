import * as React from 'react';

export type AuthUser = { id: number; email: string; displayName: string | null } | null;

type AuthState = {
  user: AuthUser;
  roles: string[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, displayName?: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthCtx = React.createContext<AuthState | undefined>(undefined);

async function json<T = any>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    ...init,
  } as RequestInit);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser>(null);
  const [roles, setRoles] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | undefined>();

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await json<{ user: AuthUser; roles: string[] }>('/api/v1/auth/me');
      setUser(data.user);
      setRoles(data.roles || []);
      setError(undefined);
    } catch (e) {
      setUser(null);
      setRoles([]);
      setError('auth_error');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const login = React.useCallback(async (email: string, password: string) => {
    try {
      await json('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      await refresh();
      return true;
    } catch { setError('invalid_credentials'); return false; }
  }, [refresh]);

  const register = React.useCallback(async (email: string, password: string, displayName?: string) => {
    try {
      await json('/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ email, password, displayName }) });
      return true;
    } catch { setError('register_failed'); return false; }
  }, []);

  const logout = React.useCallback(async () => {
    try { await json('/api/v1/auth/logout', { method: 'POST' }); } catch {}
    setUser(null); setRoles([]);
  }, []);

  const value: AuthState = { user, roles, loading, error, refresh, login, register, logout };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <div style={{ padding: 16 }}>Please login.</div>;
  return <>{children}</>;
}

export function RequireRole({ role, children }: { role: string; children: React.ReactNode }) {
  const { roles, loading } = useAuth();
  if (loading) return null;
  if (!roles.includes(role)) return <div style={{ padding: 16 }}>Forbidden.</div>;
  return <>{children}</>;
}

