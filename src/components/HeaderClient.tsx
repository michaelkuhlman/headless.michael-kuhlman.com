'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { useCart, openBag } from '@/lib/client/cart';
import { useAuth } from '@/lib/client/auth';
import { saved, recentSearches } from '@/lib/client/lists';
import { mediaSrc, priceInfo, money } from '@/lib/format';
import type { ProductCard } from '@/lib/magento/types';

type Cat = { name: string; href: string };

export function ScrollHeader() {
  useEffect(() => {
    const root = document.documentElement;
    let on = false;
    const f = () => {
      const s = window.scrollY > 24;
      if (s !== on) {
        on = s;
        root.classList.toggle('ts-scrolled', s);
      }
    };
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  return null;
}

function isCurrent(path: string, href: string) {
  return path === href || path.startsWith(href.replace(/\.html$/, '/'));
}

export function NavLinks({ cats }: { cats: Cat[] }) {
  const path = usePathname();
  return (
    <ul>
      {cats.map((c) => (
        <li key={c.href}>
          <Link href={c.href} prefetch aria-current={isCurrent(path, c.href) ? 'page' : undefined}>
            {c.name.replace(' & Covers', '').replace(' & Headwear', '').replace('Court & ', '')}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function lock(on: boolean) {
  document.documentElement.classList.toggle('ts-locked', on);
}

export function DrawerToggle({ cats }: { cats: Cat[] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const path = usePathname();
  const auth = useAuth();
  const closeRef = useRef<HTMLButtonElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    lock(open);
    if (open) closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onResize = () => window.innerWidth >= 768 && setOpen(false);
    if (open) {
      window.addEventListener('keydown', onKey);
      window.addEventListener('resize', onResize);
    }
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    btnRef.current?.focus();
  };

  return (
    <>
      <button ref={btnRef} type="button" className="ts-icon-btn ts-nav-toggle" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon name="menu" />
      </button>
      {mounted &&
        createPortal(
          <>
            <div className={`ts-drawer-scrim${open ? ' is-open' : ''}`} hidden={!open} onClick={close} />
            <nav className={`ts-drawer${open ? ' is-open' : ''}`} aria-label="Menu" aria-hidden={!open} inert={!open}>
              <img className="ts-drawer__logo" src="/logo.svg" alt="" width={120} height={31} />
              <button ref={closeRef} type="button" className="ts-icon-btn ts-drawer__close" aria-label="Close menu" onClick={close}>
                <Icon name="close" />
              </button>
              <p className="ts-drawer__group">Shop</p>
              <ul className="ts-drawer__cats">
                {cats.map((c) => (
                  <li key={c.href}>
                    <Link href={c.href} prefetch aria-current={isCurrent(path, c.href) ? 'page' : undefined} onClick={() => setOpen(false)}>
                      <span>{c.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="ts-drawer__section">
                <p className="ts-drawer__group">Account</p>
                <ul className="ts-drawer__links">
                  {auth.loggedIn ? (
                    <>
                      <li><Link href="/customer/account/">My account</Link></li>
                      <li><Link href="/sales/order/history/">My orders</Link></li>
                    </>
                  ) : (
                    <>
                      <li><Link href="/customer/account/login/">Sign in</Link></li>
                      <li><Link href="/customer/account/create/">Create an account</Link></li>
                    </>
                  )}
                </ul>
              </div>
              <div className="ts-drawer__section">
                <p className="ts-drawer__group">Help</p>
                <ul className="ts-drawer__links">
                  <li><Link href="/saved/">Saved items</Link></li>
                  <li><Link href="/shipping-returns">Shipping &amp; Returns</Link></li>
                  <li><Link href="/faq">FAQ</Link></li>
                  <li><Link href="/contact">Contact us</Link></li>
                  <li><Link href="/sales/guest/form/">Order status</Link></li>
                </ul>
              </div>
            </nav>
          </>,
          document.body,
        )}
    </>
  );
}

interface SearchRes {
  q: string;
  total: number;
  items: ProductCard[];
  categories: { name: string; url_path: string }[];
}

function highlight(name: string, q: string) {
  const i = name.toLowerCase().indexOf(q.toLowerCase());
  if (!q || i < 0) return name;
  return (
    <>
      {name.slice(0, i)}
      <mark>{name.slice(i, i + q.length)}</mark>
      {name.slice(i + q.length)}
    </>
  );
}

const POPULAR = ['carbon paddle', 'tour 40', 'grip', 'bag', 'visor'];

export function SearchBox() {
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false); // phone slide-down
  const [focus, setFocus] = useState(false);
  const [res, setRes] = useState<SearchRes | null>(null);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<string, SearchRes>());
  const recents = recentSearches.use();
  const id = useId();

  useEffect(() => {
    setFocus(false);
    setOpen(false);
  }, [path]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRes(null);
      return;
    }
    const hit = cache.current.get(term.toLowerCase());
    if (hit) {
      setRes(hit);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal });
        const j = (await r.json()) as SearchRes;
        cache.current.set(term.toLowerCase(), j);
        setRes(j);
        setActive(-1);
      } catch {}
    }, 140);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  useEffect(() => {
    if (!focus) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setFocus(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [focus]);

  const go = (term: string) => {
    const t = term.trim();
    if (!t) return;
    recentSearches.add(t.toLowerCase());
    setFocus(false);
    setOpen(false);
    inputRef.current?.blur();
    router.push(`/catalogsearch/result/?q=${encodeURIComponent(t)}`);
  };

  const items = res?.items ?? [];
  const term = q.trim();
  const showPanel = focus && (term.length >= 2 ? !!res : true);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && items.length) {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === 'ArrowUp' && items.length) {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === 'Escape') {
      setFocus(false);
      setOpen(false);
    } else if (e.key === 'Enter' && active >= 0 && items[active]) {
      e.preventDefault();
      recentSearches.add(term.toLowerCase());
      setFocus(false);
      router.push(`/${items[active].url_key}.html`);
    }
  };

  return (
    <>
      <button
        type="button"
        className="ts-icon-btn ts-search-toggle"
        aria-label={open ? 'Close search' : 'Search'}
        aria-expanded={open}
        onClick={() => {
          const n = !open;
          setOpen(n);
          if (n) setTimeout(() => inputRef.current?.focus(), 30);
        }}
      >
        <Icon name={open ? 'close' : 'search'} />
      </button>
      <div ref={boxRef} className={`ts-search${open ? ' is-open' : ''}`}>
        <form
          role="search"
          action="/catalogsearch/result/"
          onSubmit={(e) => {
            e.preventDefault();
            go(q);
          }}
        >
          <div className="ts-search__field">
            <label htmlFor={id} className="sr-only">Search the shop</label>
            <input
              ref={inputRef}
              id={id}
              type="search"
              name="q"
              placeholder="Search the shop"
              autoComplete="off"
              maxLength={80}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setFocus(true)}
              onKeyDown={onKey}
              role="combobox"
              aria-expanded={showPanel}
              aria-controls={`${id}-ls`}
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? `${id}-o${active}` : undefined}
            />
            <button type="submit" className="ts-icon-btn ts-search__submit" aria-label="Search">
              <Icon name="search" />
            </button>
          </div>
        </form>
        {showPanel && (
          <div className="ts-ls" id={`${id}-ls`}>
            {term.length < 2 ? (
              <>
                {recents.length > 0 && (
                  <>
                    <div className="ts-ls__head">
                      Recent searches
                      <button type="button" onClick={() => recentSearches.clear()}>Clear</button>
                    </div>
                    <ul className="ts-ls__recent">
                      {recents.map((r) => (
                        <li key={r}>
                          <a href={`/catalogsearch/result/?q=${encodeURIComponent(r)}`} onClick={(e) => { e.preventDefault(); setQ(r); go(r); }}>
                            <Icon name="clock" size={18} style={{ color: 'var(--ts-muted)' }} />
                            {r}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <div className="ts-ls__head">Popular searches</div>
                <div className="ts-ls__chips">
                  {POPULAR.map((p) => (
                    <button key={p} type="button" className="ts-chip" onClick={() => { setQ(p); go(p); }}>
                      {p}
                    </button>
                  ))}
                </div>
              </>
            ) : res && items.length ? (
              <>
                {res.categories.length > 0 && (
                  <div className="ts-ls__chips" style={{ paddingTop: 4 }}>
                    {res.categories.map((c) => (
                      <Link key={c.url_path} className="ts-chip" href={`/${c.url_path}.html`} prefetch>
                        {c.name}
                      </Link>
                    ))}
                  </div>
                )}
                <div className="ts-ls__head">Products</div>
                <ul className="ts-ls__list" role="listbox" aria-label="Products">
                  {items.map((p, i) => {
                    const src = mediaSrc(p.small_image?.url);
                    const pr = priceInfo(p.price_range);
                    return (
                      <li key={p.uid} id={`${id}-o${i}`} role="option" aria-selected={i === active} className={`ts-ls__item${i === active ? ' is-active' : ''}`}>
                        <Link href={`/${p.url_key}.html`} prefetch onClick={() => recentSearches.add(term.toLowerCase())}>
                          <span className="ts-ls__thumb">{src && <Image src={src} alt="" width={56} height={70} sizes="64px" />}</span>
                          <span className="ts-ls__name">{highlight(p.name, term)}</span>
                          <span className={`ts-price${pr.onSale ? ' ts-price--special' : ''}`}>{money(pr.final)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <a className="ts-ls__all" href={`/catalogsearch/result/?q=${encodeURIComponent(term)}`} onClick={(e) => { e.preventDefault(); go(term); }}>
                  See all {res.total} results
                </a>
              </>
            ) : (
              <p className="ts-ls__empty">
                No products match <strong>&ldquo;{term}&rdquo;</strong>. Try a shorter word, like &ldquo;paddle&rdquo; or &ldquo;ball&rdquo;.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export function AccountLink() {
  const auth = useAuth();
  return (
    <Link
      className="ts-icon-btn ts-account"
      href={auth.loggedIn ? '/customer/account/' : '/customer/account/login/'}
      aria-label={auth.loggedIn ? `My account (${auth.firstname ?? 'signed in'})` : 'Sign in'}
      title={auth.loggedIn ? `Hi, ${auth.firstname ?? 'there'}` : 'Sign in'}
    >
      <Icon name="user" />
    </Link>
  );
}

export function SavedLink() {
  const list = saved.use();
  return (
    <Link className="ts-icon-btn ts-saved-link" href="/saved/" aria-label={`Saved items${list.length ? ` (${list.length})` : ''}`}>
      <Icon name="heart" />
      {list.length > 0 && <span className="ts-badge" style={{ background: 'var(--ts-clay)', color: '#fff' }}>{list.length}</span>}
    </Link>
  );
}

export function BagButton() {
  const { cart, bump } = useCart();
  const n = cart?.total_quantity ?? 0;
  const [anim, setAnim] = useState(false);
  useEffect(() => {
    if (!bump) return;
    setAnim(true);
    const t = setTimeout(() => setAnim(false), 500);
    return () => clearTimeout(t);
  }, [bump]);
  return (
    <button type="button" className="ts-icon-btn ts-bag-btn" aria-label={`Bag${n ? `, ${n} item${n === 1 ? '' : 's'}` : ', empty'}`} onClick={openBag}>
      <Icon name="bag" />
      {n > 0 && <span className={`ts-badge${anim ? ' is-bump' : ''}`}>{n > 99 ? '99+' : n}</span>}
    </button>
  );
}
