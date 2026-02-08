'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { AdminRole, AdminUser } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL || '/admin-api';
const TOKEN_KEY = 'qfl_admin_access_token';

type AuthContextValue = {
  user: AdminUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  authFetch: (path: string, init?: RequestInit, retryOnUnauthorized?: boolean) => Promise<Response>;
  hasRole: (...roles: AdminRole[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const persistToken = useCallback((token: string | null) => {
    setAccessToken(token);
    if (typeof window === 'undefined') {
      return;
    }
    if (!token) {
      localStorage.removeItem(TOKEN_KEY);
      return;
    }
    localStorage.setItem(TOKEN_KEY, token);
  }, []);

  const clearAuth = useCallback(() => {
    persistToken(null);
    setUser(null);
  }, [persistToken]);

  const refreshAccess = useCallback(async (): Promise<string | null> => {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      clearAuth();
      return null;
    }

    const data = await response.json();
    const token = data.access_token as string;
    persistToken(token);
    setUser(data.user as AdminUser);
    return token;
  }, [clearAuth, persistToken]);

  const authFetch = useCallback(
    async (path: string, init: RequestInit = {}, retryOnUnauthorized = true): Promise<Response> => {
      const headers = new Headers(init.headers || {});
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
      }

      const response = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers,
        credentials: 'include',
      });

      if (response.status === 401 && retryOnUnauthorized) {
        const nextToken = await refreshAccess();
        if (!nextToken) {
          return response;
        }

        const retryHeaders = new Headers(init.headers || {});
        retryHeaders.set('Authorization', `Bearer ${nextToken}`);
        return fetch(`${API_BASE}${path}`, {
          ...init,
          headers: retryHeaders,
          credentials: 'include',
        });
      }

      return response;
    },
    [accessToken, refreshAccess]
  );

  const loadMe = useCallback(
    async (token: string) => {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        return false;
      }

      const me = (await response.json()) as AdminUser;
      setUser(me);
      return true;
    },
    []
  );

  useEffect(() => {
    const bootstrap = async () => {
      if (typeof window === 'undefined') {
        setLoading(false);
        return;
      }

      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setLoading(false);
        return;
      }

      persistToken(storedToken);
      const isValid = await loadMe(storedToken);
      if (!isValid) {
        const refreshed = await refreshAccess();
        if (refreshed) {
          await loadMe(refreshed);
        }
      }
      setLoading(false);
    };

    void bootstrap();
  }, [loadMe, persistToken, refreshAccess]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Неверный email или пароль');
      }

      const data = await response.json();
      persistToken(data.access_token as string);
      setUser(data.user as AdminUser);
      router.push('/dashboard');
    },
    [persistToken, router]
  );

  const logout = useCallback(async () => {
    await authFetch('/auth/logout', { method: 'POST' }, false);
    clearAuth();
    router.push('/login');
  }, [authFetch, clearAuth, router]);

  const hasRole = useCallback(
    (...roles: AdminRole[]) => {
      if (!user) {
        return false;
      }
      return roles.includes(user.role);
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      loading,
      login,
      logout,
      authFetch,
      hasRole,
    }),
    [user, accessToken, loading, login, logout, authFetch, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
