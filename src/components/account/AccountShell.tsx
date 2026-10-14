'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authExpired, logout, useAuth } from '@/lib/client/auth';
import { gql, GqlError } from '@/lib/client/gql';

/** Account area frame: sign-in guard plus the left navigation (a pill bar on small screens), as on the classic store. */

const NAV: [string, string][] = [
  ['My Account', '/customer/account/'],
  ['My Orders', '/sales/order/history/'],
  ['Address Book', '/customer/address/'],
  ['Account Information', '/customer/account/edit/'],
  ['Newsletter Subscriptions', '/newsletter/manage/'],
];

export function AccountShell({ title, children }: { title: string; children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // hl_auth is readable only in the browser: wait one tick before deciding the visitor is a guest
    const t = setTimeout(() => setChecked(true), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (checked && !auth.loggedIn) router.replace(`/customer/account/login/?return=${encodeURIComponent(path + location.search)}`);
  }, [checked, auth.loggedIn, router, path]);

  if (!checked || !auth.loggedIn) return <div className="ts-acct ts-acct--loading" aria-busy="true" />;

  return (
    <div className="ts-acct">
      <nav aria-label="My account">
        <ul className="ts-acct__nav">
          {NAV.map(([label, href]) => (
            <li key={href}>
              <Link href={href} aria-current={path === href || (href === '/sales/order/history/' && path.startsWith('/sales/order/')) ? 'page' : undefined}>
                {label}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={async () => {
                await logout();
                router.replace('/customer/account/logout/');
              }}
            >
              Sign Out
            </button>
          </li>
        </ul>
      </nav>
      <div className="ts-acct__main">
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  );
}

/** Fetch customer data for an account page; an expired token signs the visitor out. */
export function useCustomer<T>(query: string, deps: unknown[] = []): { data: T | null; error: string | null; reload: () => void } {
  const auth = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!auth.loggedIn) return;
    let live = true;
    gql<T>(query)
      .then((d) => live && setData(d))
      .catch((e) => {
        if (!live) return;
        if (e instanceof GqlError && /authoriz|isn't authorized/i.test(e.message)) authExpired();
        setError(e instanceof Error ? e.message : 'Could not load your account.');
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loggedIn, query, n, ...deps]);
  return { data, error, reload: () => setN((x) => x + 1) };
}

export const fmtDate = (s: string) => {
  // guestOrder returns a store-formatted "dd/mm/yyyy hh:mm:ss"; customer orders return "yyyy-mm-dd hh:mm:ss"
  const dm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (dm) s = `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')} 12:00:00`;
  const d = new Date(s.replace(' ', 'T') + (s.includes('Z') || s.includes('+') ? '' : 'Z'));
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
};
