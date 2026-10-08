import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onSessionRefreshed, post, refreshSession, setAccessToken, setOnAuthLost } from './api';

export interface Session {
  accessToken: string;
  user: { id: string; email: string; fullName: string; isOwner: boolean; permissions: string[] };
  tenant: { id: string; slug: string; name: string };
}

interface AuthState {
  session: Session | null;
  loading: boolean;
  login: (tenant: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((s: Session | null) => {
    setAccessToken(s?.accessToken ?? null);
    setSession(s);
  }, []);

  useEffect(() => {
    setOnAuthLost(() => apply(null));
    onSessionRefreshed((s) => setSession(s as Session));
    // Silent sign-in from the refresh cookie on page load
    refreshSession().finally(() => setLoading(false));
  }, [apply]);

  const login = useCallback(
    async (tenant: string, email: string, password: string) => {
      const s = await post<Session>('/auth/login', { tenant, email, password });
      localStorage.setItem('erp_tenant', tenant);
      apply(s);
    },
    [apply],
  );

  const logout = useCallback(async () => {
    await post('/auth/logout').catch(() => undefined);
    apply(null);
  }, [apply]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      login,
      logout,
      can: (p) => {
        const perms = session?.user.permissions ?? [];
        return perms.some((g) => g === '*' || g === p || (g.endsWith('.*') && p.startsWith(g.slice(0, -1))));
      },
    }),
    [session, loading, login, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
