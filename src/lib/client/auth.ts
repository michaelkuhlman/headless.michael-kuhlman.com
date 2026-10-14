'use client';

import { useSyncExternalStore } from 'react';

/*
 * Customer session. The Magento token sits in an httpOnly cookie (hl_token) that only /api/* can read; a readable
 * companion cookie (hl_auth = first name) tells the UI that someone is logged in.
 */

export interface AuthState {
  loggedIn: boolean;
  firstname: string | null;
}

const listeners = new Set<() => void>();
let cached: AuthState = { loggedIn: false, firstname: null };
let cachedRaw: string | null = null;
const SERVER: AuthState = { loggedIn: false, firstname: null };

function read(): AuthState {
  if (typeof document === 'undefined') return SERVER;
  const m = document.cookie.match(/(?:^|;\s*)hl_auth=([^;]*)/);
  const raw = m ? m[1] : '';
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  cached = raw ? { loggedIn: true, firstname: decodeURIComponent(raw) || null } : { loggedIn: false, firstname: null };
  return cached;
}

export const getAuth = read;

export function subscribeAuth(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function notify() {
  cachedRaw = null;
  listeners.forEach((l) => l());
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribeAuth, read, () => SERVER);
}

async function post(path: string, body: unknown): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    return { ok: res.ok && j.ok !== false, message: j.message };
  } catch {
    return { ok: false, message: 'Network error. Please try again.' };
  }
}

const guestCartId = () => {
  try {
    return localStorage.getItem('hl_cart');
  } catch {
    return null;
  }
};

export async function login(email: string, password: string) {
  const r = await post('/api/auth/login', { email, password, guestCartId: guestCartId() });
  if (r.ok) {
    try {
      localStorage.removeItem('hl_cart');
    } catch {}
    notify();
  }
  return r;
}

export async function register(input: { firstname: string; lastname: string; email: string; password: string; newsletter: boolean }) {
  const r = await post('/api/auth/register', { ...input, guestCartId: guestCartId() });
  if (r.ok) {
    try {
      localStorage.removeItem('hl_cart');
    } catch {}
    notify();
  }
  return r;
}

export async function logout() {
  await post('/api/auth/logout', {});
  try {
    localStorage.removeItem('hl_cart');
  } catch {}
  notify();
}

/** Called when an API answer shows the token expired. */
export function authExpired() {
  document.cookie = 'hl_auth=; Max-Age=0; path=/';
  notify();
}
