'use client';

import Link from 'next/link';
import { openerFocus, trapTab } from '@/lib/client/focus';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';
import { useCart, closeDrawer, updateQty, removeItem, addToCart, clearError, type CartItem } from '@/lib/client/cart';
import { openQuickView } from '@/lib/client/ui';
import { mediaSrc, money, priceInfo } from '@/lib/format';
import { FREE_SHIP } from '@/lib/site';
import type { ProductCard } from '@/lib/magento/types';

export function ShipMeter({ subtotal }: { subtotal: number }) {
  const left = Math.max(0, FREE_SHIP - subtotal);
  const pct = Math.min(100, (subtotal / FREE_SHIP) * 100);
  return (
    <div className={`ts-meter${left <= 0 ? ' is-free' : ''}`}>
      <p className="ts-meter__msg">
        {left <= 0 ? (
          <strong>You’ve unlocked free shipping.</strong>
        ) : subtotal <= 0 ? (
          <>
            Free shipping on orders over <strong>{money(FREE_SHIP)}</strong>
          </>
        ) : (
          <>
            You’re <strong>{money(left)}</strong> away from free shipping
          </>
        )}
      </p>
      <div className="ts-meter__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Progress to free shipping">
        <span style={{ width: `${pct.toFixed(1)}%` }} />
      </div>
    </div>
  );
}

export function lineImage(it: CartItem) {
  return mediaSrc(it.configured_variant?.small_image?.url ?? it.product.small_image?.url);
}
export function lineOptions(it: CartItem): string[] {
  if (it.configurable_options?.length) return it.configurable_options.map((o) => o.value_label);
  if (it.bundle_options?.length) return it.bundle_options.flatMap((o) => o.values.map((v) => (v.quantity > 1 ? `${v.quantity} x ${v.label}` : v.label)));
  return [];
}

function Line({ it, isNew, onNav }: { it: CartItem; isNew: boolean; onNav: () => void }) {
  const [pending, setPending] = useState(false);
  const src = lineImage(it);
  const opts = lineOptions(it);
  const each = it.prices.price.value;
  const run = async (fn: () => Promise<void>) => {
    setPending(true);
    await fn();
    setPending(false);
  };
  return (
    <li className={`ts-bag-line${isNew ? ' is-new' : ''}${pending ? ' is-pending' : ''}`}>
      <Link className="ts-bag-line__img" href={`/${it.product.url_key}.html`} onClick={onNav} tabIndex={-1} aria-hidden="true">
        {src && <Image src={src} alt="" width={80} height={100} sizes="96px" />}
      </Link>
      <div className="ts-bag-line__main">
        <div className="ts-bag-line__top">
          <p className="ts-bag-line__name">
            <Link href={`/${it.product.url_key}.html`} onClick={onNav}>{it.product.name}</Link>
          </p>
          <p className="ts-bag-line__price">
            <strong>{money(it.prices.row_total.value)}</strong>
            {it.quantity > 1 && <span className="ts-bag-line__each">{money(each)} each</span>}
          </p>
        </div>
        {opts.length > 0 && (
          <p className="ts-bag-line__opts">
            {opts.map((o, i) => (
              <span key={i}>{o}</span>
            ))}
          </p>
        )}
        <div className="ts-bag-line__row">
          <div className="ts-bag-qty" role="group" aria-label={`Quantity for ${it.product.name}`}>
            <button type="button" aria-label="Decrease quantity" disabled={pending || it.quantity <= 1} onClick={() => run(() => updateQty(it.uid, it.quantity - 1))}>
              <Icon name="minus" />
            </button>
            <span className="ts-bag-qty__val" aria-live="polite">{it.quantity}</span>
            <button type="button" aria-label="Increase quantity" disabled={pending} onClick={() => run(() => updateQty(it.uid, it.quantity + 1))}>
              <Icon name="plus" />
            </button>
          </div>
          <div className="ts-bag-line__links">
            <button type="button" className="ts-bag-line__link" disabled={pending} onClick={() => run(() => removeItem(it.uid))} aria-label={`Remove ${it.product.name}`}>
              Remove
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function Picks({ urlKey, inBag }: { urlKey: string; inBag: Set<string> }) {
  const [items, setItems] = useState<ProductCard[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/product?key=${encodeURIComponent(urlKey)}`)
      .then((r) => r.json())
      .then((j: { product: { crosssell_products: ProductCard[]; related_products: ProductCard[] } | null }) => {
        if (!live || !j.product) return;
        const list = j.product.crosssell_products.length ? j.product.crosssell_products : j.product.related_products;
        setItems(list);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [urlKey]);
  const show = (items ?? []).filter((p) => !inBag.has(p.sku) && p.stock_status === 'IN_STOCK').slice(0, 3);
  if (!show.length) return null;
  return (
    <section className="ts-bag__recs" aria-label="Pairs well with">
      <h3>Pairs well with</h3>
      <ul className="ts-bag__picks">
        {show.map((p) => {
          const src = mediaSrc(p.small_image?.url);
          const pr = priceInfo(p.price_range);
          const simple = p.__typename === 'SimpleProduct' || p.__typename === 'VirtualProduct';
          return (
            <li key={p.uid}>
              <Link className="ts-bag__pick-img" href={`/${p.url_key}.html`} onClick={closeDrawer} tabIndex={-1} aria-hidden="true">
                {src && <Image src={src} alt="" width={56} height={70} sizes="64px" />}
              </Link>
              <Link className="ts-bag__pick-name" href={`/${p.url_key}.html`} onClick={closeDrawer}>{p.name}</Link>
              <span className="ts-bag__pick-price">
                <span className={`ts-price${pr.onSale ? ' ts-price--special' : ''}`}>{money(pr.final)}</span>
                {pr.onSale && <span className="ts-price ts-price--old">{money(pr.regular)}</span>}
              </span>
              {simple ? (
                <button
                  type="button"
                  className="ts-bag__pick-btn"
                  disabled={busy === p.sku}
                  aria-label={`Add ${p.name} to bag`}
                  onClick={async () => {
                    setBusy(p.sku);
                    await addToCart([{ sku: p.sku, quantity: 1 }], undefined, false);
                    setBusy(null);
                  }}
                >
                  {busy === p.sku ? <span className="ts-spinner" style={{ width: 14, height: 14 }} /> : <Icon name="plus" />}
                  Add
                </button>
              ) : (
                <button type="button" className="ts-bag__pick-btn ts-bag__pick-btn--opts" onClick={() => openQuickView(p.url_key)} aria-label={`Choose options for ${p.name}`}>
                  Options
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function BagDrawer() {
  const { cart, ready, drawer, added, error, busy } = useCart();
  const path = usePathname();
  const open = drawer !== 'closed';
  const [shown, setShown] = useState(false); // mounted
  const [visible, setVisible] = useState(false); // transitioned in
  const panel = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      prevFocus.current = openerFocus();
      setShown(true);
      document.documentElement.classList.add('ts-locked');
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      setTimeout(() => panel.current?.focus(), 60);
    } else if (shown) {
      setVisible(false);
      document.documentElement.classList.remove('ts-locked');
      const t = setTimeout(() => setShown(false), 420);
      prevFocus.current?.focus?.();
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    closeDrawer();
  }, [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
      trapTab(e, panel.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!shown) return null;
  const items = cart?.items ?? [];
  const count = cart?.total_quantity ?? 0;
  const subtotal = cart?.prices.subtotal_including_tax.value ?? 0;
  const newKey = drawer === 'added' ? added?.url_key : undefined;
  const inBag = new Set(items.map((i) => i.product.sku));

  return (
    <div className={`ts-bag${visible ? ' is-open' : ''}`}>
      <button type="button" className="ts-bag__backdrop" aria-label="Close bag" tabIndex={-1} onClick={closeDrawer} />
      <div ref={panel} className="ts-bag__panel" role="dialog" aria-modal="true" aria-labelledby="ts-bag-title" tabIndex={-1}>
        <div className="ts-bag__head">
          <h2 className="ts-bag__title" id="ts-bag-title">
            Your bag {count > 0 && <span className="ts-bag__count">({count})</span>}
          </h2>
          <button type="button" className="ts-icon-btn" aria-label="Close bag" onClick={closeDrawer}>
            <Icon name="close" />
          </button>
        </div>
        {drawer === 'added' && added && (
          <div className="ts-bag__added" role="status">
            <p>
              <span className="ts-bag__added-icon" aria-hidden="true" />
              <span>
                <strong>{added.name}</strong> {added.qty > 1 ? `(x${added.qty}) ` : ''}was added to your bag.
              </span>
            </p>
          </div>
        )}
        <div className="ts-bag__body">
          {error && (
            <p className="ts-bag__err" role="alert" onClick={clearError}>
              {error}
            </p>
          )}
          {!ready ? (
            <div className="ts-bag__skeleton" aria-label="Loading your bag">
              <span />
              <span />
              <span />
            </div>
          ) : items.length === 0 ? (
            <div className="ts-bag__empty">
              <span className="ts-bag__empty-icon">
                <Icon name="bag" />
              </span>
              <p className="ts-bag__empty-title">Your bag is empty</p>
              <p>Start with a paddle, a sleeve of balls or something for the bag.</p>
              <div className="ts-bag__empty-links">
                <Link href="/paddles.html" onClick={closeDrawer}>Paddles</Link>
                <Link href="/balls.html" onClick={closeDrawer}>Balls</Link>
                <Link href="/bags-covers.html" onClick={closeDrawer}>Bags &amp; Covers</Link>
              </div>
            </div>
          ) : (
            <>
              <ShipMeter subtotal={subtotal} />
              <ul className="ts-bag__lines">
                {items.map((it) => (
                  <Line key={it.uid} it={it} isNew={!!newKey && it.product.url_key === newKey} onNav={closeDrawer} />
                ))}
              </ul>
              {(newKey || items[items.length - 1]) && <Picks urlKey={newKey ?? items[items.length - 1].product.url_key} inBag={inBag} />}
            </>
          )}
        </div>
        {items.length > 0 && (
          <div className="ts-bag__foot">
            <p className="ts-bag__total">
              <span>Subtotal</span>
              <strong>{money(subtotal)}</strong>
            </p>
            <p className="ts-bag__note">Shipping and taxes calculated at checkout.</p>
            <Link className="ts-button ts-bag__checkout" href="/checkout/" onClick={closeDrawer} aria-disabled={busy}>
              Checkout <Icon name="arrowR" size={18} />
            </Link>
            <Link className="ts-bag__view" href="/checkout/cart/" onClick={closeDrawer}>
              View bag
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
