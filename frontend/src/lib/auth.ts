"use client";

import { useState, useEffect, createContext, useContext } from "react";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenant_id: string;
}

export interface AuthTenant {
  id: string;
  slug: string;
  display_name: string;
  plan_tier: string;
}

export interface AuthState {
  user: AuthUser | null;
  tenant: AuthTenant | null;
  token: string | null;
  loading: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiRegister(email: string, password: string, business_name: string) {
  const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, business_name }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Registration failed");
  }
  return res.json() as Promise<{ token: string; onboarding: boolean }>;
}

export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Login failed");
  }
  return res.json() as Promise<{ token: string; onboarding: boolean }>;
}

export async function apiMe(token: string): Promise<{ user: AuthUser; tenant: AuthTenant } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // 401/403 = bad token, clear session. 5xx/network = backend down, keep session.
    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) throw new Error("server_error");
    return res.json();
  } catch (e: any) {
    if (e?.message === "server_error") throw e;
    // Network error or CORS — don't wipe the session, treat as transient
    throw new Error("network_error");
  }
}

export async function apiLogout(token: string) {
  await fetch(`${API_BASE}/api/v1/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}
