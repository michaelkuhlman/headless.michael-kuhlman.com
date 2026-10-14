'use client';

import { useSyncExternalStore } from 'react';

/* Tiny UI stores: toast + quick view. */

type Toast = { id: number; text: string; href?: string; link?: string } | null;
let toast: Toast = null;
let qv: string | null = null;
const ls = new Set<() => void>();
const emit = () => ls.forEach((l) => l());
const sub = (l: () => void) => {
  ls.add(l);
  return () => ls.delete(l);
};

let timer: ReturnType<typeof setTimeout> | undefined;
export function showToast(text: string, href?: string, link?: string) {
  toast = { id: Date.now(), text, href, link };
  emit();
  clearTimeout(timer);
  timer = setTimeout(() => {
    toast = null;
    emit();
  }, 3200);
}
export const useToast = () => useSyncExternalStore(sub, () => toast, () => null);

export function openQuickView(urlKey: string) {
  qv = urlKey;
  emit();
}
export function closeQuickView() {
  qv = null;
  emit();
}
export const useQuickView = () => useSyncExternalStore(sub, () => qv, () => null);
