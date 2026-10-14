'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '../Icon';
import { ProductCard } from '../ProductCard';
import { RecentStrip } from '../product/RecentStrip';
import { lineImage } from '../BagDrawer';
import { CartSummary, DiscountBox } from './CartSummary';
import { addToCart, removeItem, updateQty, useCart, type CartItem } from '@/lib/client/cart';
import { openQuickView, showToast } from '@/lib/client/ui';
import { money } from '@/lib/format';
import type { Region } from '@/lib/magento/catalog';
import type { ProductCard as Card } from '@/lib/magento/types';

/** The bag page: same layout as the classic store's cart (lines, discount code, summary, Pairs well with). */

function options(it: CartItem): [string, string][] {
  if (it.configurable_options?.length) return it.configurable_options.map((o) => [o.option_label, o.value_label]);
  if (it.bundle_options?.length) return it.bundle_options.map((o) => [o.label, o.values.map((v) => (v.quantity > 1 ? `${v.quantity} x ${v.label}` : v.label)).join(', ')]);
  return [];
}

function Line({ it }: { it: CartItem }) {
  const [pending, setPending] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setPending(true);
    await fn();
    setPending(false);
  };
  const src = lineImage(it);
  const href = `/${it.product.url_key}.html`;
  // Edit opens the product with this line's options and quantity filled in; the buy box then updates the line
  const optUids = (it.configurable_options ?? []).map((o) => o.configurable_product_option_value_uid).filter(Boolean);
  const editHref = `${href}?edit=${encodeURIComponent(it.uid)}&qty=${it.quantity}${optUids.length ? `&opt=${optUids.map((u) => encodeURIComponent(u!)).join(',')}` : ''}`;
  const opts = options(it);
  const disc = it.prices.total_item_discount?.value ?? 0;
  return (
    <div className={`ts-line${pending ? ' is-pending' : ''}`}>
      <Link className="ts-line__img" href={href} tabIndex={-1} aria-hidden="true">
        {src && <Image src={src} alt="" fill sizes="112px" />}
      </Link>
      <div className="ts-line__info">
        <Link className="ts-line__name" href={href}>
          {it.product.name}
        </Link>
        {opts.length > 0 && (
          <dl className="ts-line__opts">
            {opts.map(([k, v]) => (
              <span key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </span>
            ))}
          </dl>
        )}
        <div className="ts-line__acts">
          <Link href={editHref} aria-label={`Edit ${it.product.name}`} title="Edit">
            <Icon name="edit" />
          </Link>
          <button type="button" aria-label={`Remove ${it.product.name}`} title="Remove" disabled={pending} onClick={() => run(() => removeItem(it.uid))}>
            <Icon name="trash" />
          </button>
        </div>
      </div>
      <div className="ts-line__price">{money(it.prices.price.value)}</div>
      <div className="ts-line__qty">
        <div className="ts-qty" role="group" aria-label={`Quantity for ${it.product.name}`}>
          <button type="button" aria-label="Decrease quantity" disabled={pending || it.quantity <= 1} onClick={() => run(() => updateQty(it.uid, it.quantity - 1))}>
            <Icon name="minus" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={99}
            key={it.quantity}
            defaultValue={it.quantity}
            aria-label={`Quantity for ${it.product.name}`}
            onBlur={(e) => {
              const n = Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1));
              if (n !== it.quantity) void run(() => updateQty(it.uid, n));
              else e.target.value = String(n);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
          <button type="button" aria-label="Increase quantity" disabled={pending || it.quantity >= 99} onClick={() => run(() => updateQty(it.uid, it.quantity + 1))}>
            <Icon name="plus" />
          </button>
        </div>
      </div>
      <div className="ts-line__sub">
        {money(it.prices.row_total.value - disc)}
        {disc > 0 && <span className="ts-price--old">{money(it.prices.row_total.value)}</span>}
      </div>
    </div>
  );
}

function PairsWell({ keys }: { keys: string[] }) {
  const [items, setItems] = useState<Card[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const sig = [...new Set(keys)].sort().join(',');
  useEffect(() => {
    if (!sig) return;
    let live = true;
    fetch(`/api/crosssell?keys=${encodeURIComponent(sig)}`)
      .then((r) => r.json())
      .then((j: { items: Card[] }) => live && setItems(j.items))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [sig]);
  if (!items.length) return null;
  return (
    <section className="ts-strip ts-pairs" aria-labelledby="ts-pairs-h">
      <div className="ts-strip__head">
        <h2 id="ts-pairs-h">Pairs well with</h2>
      </div>
      <ul className="ts-grid ts-grid--4 ts-pairs__grid">
        {items.map((p) => {
          const simple = p.__typename === 'SimpleProduct' || p.__typename === 'VirtualProduct';
          return (
            <li key={p.uid} className="ts-pairs__item">
              <ProductCard p={p} sizes="(max-width: 767px) 44vw, 200px" noQuickAdd />
              <button
                type="button"
                className="ts-button ts-button--ghost ts-button--sm ts-button--block"
                disabled={busy === p.sku}
                onClick={async () => {
                  if (!simple) return openQuickView(p.url_key);
                  setBusy(p.sku);
                  const ok = await addToCart([{ sku: p.sku, quantity: 1 }], undefined, false);
                  setBusy(null);
                  if (ok) showToast(`Added ${p.name} to your bag.`);
                }}
              >
                {simple ? 'Add to bag' : 'Choose options'}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function CartView({ regions }: { regions: Region[] }) {
  const { cart, ready } = useCart();
  const items = cart?.items ?? [];

  // back from editing a line on the product page (BuyBox): confirm, then tidy the URL
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const name = sp.get('updated');
    if (!name) return;
    showToast(`${name.slice(0, 120)} was updated in your shopping cart.`);
    history.replaceState(history.state, '', location.pathname);
  }, []);

  if (!ready) {
    return (
      <>
        <h1 className="ts-cart-title">Your bag</h1>
        <div className="ts-cart" aria-busy="true">
          <div className="ts-cart__main">
            <div className="ts-bag__skeleton">
              <span />
              <span />
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!items.length) {
    return (
      <>
        <h1 className="ts-cart-title">Your bag</h1>
        <div className="ts-cart-empty">
          <h2>You have no items in your shopping cart.</h2>
          <p>
            Click{' '}
            <Link href="/" className="ts-textlink">
              here
            </Link>{' '}
            to continue shopping.
          </p>
        </div>
        <RecentStrip />
      </>
    );
  }

  return (
    <>
      <h1 className="ts-cart-title">Your bag</h1>
      <div className="ts-cart">
        <div className="ts-cart__main">
          <div className="ts-cart__head" aria-hidden="true">
            <span>Item</span>
            <span>Price</span>
            <span>Qty</span>
            <span>Subtotal</span>
          </div>
          {items.map((it) => (
            <Line key={it.uid} it={it} />
          ))}
          <DiscountBox cart={cart!} />
        </div>
        <CartSummary cart={cart!} regions={regions} />
      </div>
      <PairsWell keys={items.map((i) => i.product.url_key)} />
    </>
  );
}
