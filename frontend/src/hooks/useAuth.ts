"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { apiMe, apiLogout, AuthUser, AuthTenant } from "@/lib/auth";

const COOKIE_KEY = "artisan_token";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

export interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  tenant: AuthTenant | null;
  loading: boolean;
  isAuthed: boolean;
  login: (t: string, u: AuthUser, tn: AuthTenant) => void;
  setTokenOnly: (t: string) => void;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function useAuthState(): AuthContextValue {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<AuthTenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = getCookie(COOKIE_KEY);
    if (t) {
      setToken(t);
      apiMe(t).then((data) => {
        if (data) {
          setUser(data.user);
          setTenant(data.tenant);
        } else {
          deleteCookie(COOKIE_KEY);
          setToken(null);
        }
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback((t: string, u: AuthUser, tn: AuthTenant) => {
    setToken(t);
    setUser(u);
    setTenant(tn);
  }, []);

  const setTokenOnly = useCallback((t: string) => {
    setToken(t);
  }, []);

  const logout = useCallback(async () => {
    const t = getCookie(COOKIE_KEY);
    if (t) await apiLogout(t).catch(() => {});
    deleteCookie(COOKIE_KEY);
    setToken(null);
    setUser(null);
    setTenant(null);
    window.location.href = "/login";
  }, []);

  return { token, user, tenant, loading, login, setTokenOnly, logout, isAuthed: !!token };
}
