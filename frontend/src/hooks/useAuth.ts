"use client";

import { useState, useEffect, useCallback } from "react";
import { apiMe, apiLogout, AuthUser, AuthTenant } from "@/lib/auth";

const TOKEN_KEY = "artisan_token";

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<AuthTenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) {
      setToken(t);
      apiMe(t).then((data) => {
        if (data) {
          setUser(data.user);
          setTenant(data.tenant);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback((t: string, u: AuthUser, tn: AuthTenant) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
    setTenant(tn);
  }, []);

  const setTokenOnly = useCallback((t: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      await apiLogout(token);
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setTenant(null);
  }, [token]);

  return { token, user, tenant, loading, login, setTokenOnly, logout, isAuthed: !!token };
}
