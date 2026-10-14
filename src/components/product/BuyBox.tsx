'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { Price, Stars } from '../ProductCard';
import { SaveButton } from '../CardActions';
import { addToCart, getCartState, useCart, type AddLine } from '@/lib/client/cart';
import { mediaSrc, money } from '@/lib/format';
import type { BundleItem, Product, Variant } from '@/lib/magento/types';

export interface BuyState {
  variant: Variant | null;
}

function Qty({ value, onChange, label = 'Quantity', small = false }: { value: number; onChange: (n: number) => void; label?: string; small?: boolean }) {
  return (
    <div className={`ts-qty${small ? ' ts-qty--sm' : ''}`} role="group" aria-label={label}>
      <button type="button" aria-label="Decrease quantity" disabled={value <= (small ? 0 : 1)} onClick={() => onChange(Math.max(small ? 0 : 1, value - 1))}>
        <Icon name="minus" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={small ? 0 : 1}
        max={99}
        value={value}
        aria-label={label}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          onChange(Number.isFinite(n) ? Math.max(small ? 0 : 1, Math.min(99, n)) : small ? 0 : 1);
        }}
      />
      <button type="button" aria-label="Increase quantity" disabled={value >= 99} onClick={() => onChange(Math.min(99, value + 1))}>
        <Icon name="plus" />
      </button>
    </div>
  );
}

function bundleDefaults(items: BundleItem[] | undefined) {
  const s: Record<string, string[]> = {};
  for (const it of items ?? []) {
    const defs = it.options.filter((o) => o.is_default).map((o) => o.uid);
    s[it.uid] = defs.length ? defs : it.required && it.options[0] ? [it.options[0].uid] : [];
  }
  return s;
}

export function BuyBox({
  p,
  onVariant,
  usps,
  compact = false,
  onAdded,
  headingLevel = 1,
}: {
  p: Product;
  onVariant?: (v: Variant | null) => void;
  usps?: React.ReactNode;
  compact?: boolean;
  onAdded?: () => void;
  headingLevel?: 1 | 2;
}) {
  const opts = useMemo(() => [...(p.configurable_options ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)), [p]);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [hint, setHint] = useState(false);
  const [bundle, setBundle] = useState<Record<string, string[]>>(() => bundleDefaults(p.bundle_items));
  const [grouped, setGrouped] = useState<Record<string, number>>(() =>
    Object.fromEntries((p.grouped_items ?? []).map((g) => [g.product.sku, g.qty || 0])),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sticky, setSticky] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useCart();

  const variant = useMemo(() => {
    if (!p.variants || opts.length === 0 || Object.keys(sel).length < opts.length) return null;
    return p.variants.find((v) => v.attributes.every((a) => sel[a.code] === a.uid)) ?? null;
  }, [p.variants, opts.length, sel]);

  useEffect(() => onVariant?.(variant), [variant, onVariant]);

  // Which values are still possible given the other picks (out-of-stock combinations are greyed out).
  const available = (code: string, uid: string) => {
    if (!p.variants) return true;
    return p.variants.some(
      (v) =>
        v.product.stock_status === 'IN_STOCK' &&
        v.attributes.some((a) => a.code === code && a.uid === uid) &&
        v.attributes.every((a) => a.code === code || !sel[a.code] || sel[a.code] === a.uid),
    );
  };

  const isConf = p.__typename === 'ConfigurableProduct';
  const isBundle = p.__typename === 'BundleProduct';
  const isGrouped = p.__typename === 'GroupedProduct';
  const stock = variant ? variant.product.stock_status : p.stock_status;
  const inStock = stock === 'IN_STOCK';
  const sku = variant?.product.sku ?? p.sku;
  const onlyLeft = variant ? variant.product.only_x_left_in_stock : p.only_x_left_in_stock;
  const missing = isConf ? opts.filter((o) => !sel[o.attribute_code]) : [];

  const bundleTotal = useMemo(() => {
    if (!isBundle) return 0;
    let t = 0;
    for (const it of p.bundle_items ?? []) {
      for (const uid of bundle[it.uid] ?? []) {
        const o = it.options.find((x) => x.uid === uid);
        if (o) t += (o.product?.price_range.minimum_price.final_price.value ?? o.price) * (o.quantity || 1);
      }
    }
    return t;
  }, [isBundle, p.bundle_items, bundle]);

  const groupedCount = Object.values(grouped).reduce((a, b) => a + b, 0);

  // phones: a sticky add-to-bag bar once the real button scrolls away
  useEffect(() => {
    if (compact || !btnRef.current || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setSticky(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(btnRef.current);
    return () => io.disconnect();
  }, [compact]);

  const add = async () => {
    setErr(null);
    if (isConf && missing.length) {
      setHint(true);
      boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    let lines: AddLine[] = [];
    let label = p.name;
    let options: string | undefined;
    let n = qty;
    if (isConf) {
      lines = [{ sku: p.sku, quantity: qty, selected_options: opts.map((o) => sel[o.attribute_code]) }];
      options = opts.map((o) => o.values.find((v) => v.uid === sel[o.attribute_code])?.label).join(' · ');
    } else if (isBundle) {
      const picked = Object.values(bundle).flat();
      const missingReq = (p.bundle_items ?? []).find((it) => it.required && !(bundle[it.uid] ?? []).length);
      if (missingReq) {
        setErr(`Choose a ${missingReq.title.toLowerCase()}.`);
        return;
      }
      lines = [{ sku: p.sku, quantity: qty, selected_options: picked }];
    } else if (isGrouped) {
      lines = Object.entries(grouped)
        .filter(([, q]) => q > 0)
        .map(([s, q]) => ({ sku: s, quantity: q }));
      if (!lines.length) {
        setErr('Choose a quantity for at least one item.');
        return;
      }
      n = groupedCount;
      label = p.name;
    } else {
      lines = [{ sku: p.sku, quantity: qty }];
    }
    setBusy(true);
    const img = mediaSrc(variant?.product.small_image?.url ?? p.small_image?.url);
    const ok = await addToCart(lines, { name: label, image: img, qty: n, options, url_key: p.url_key, crosssell: p.crosssell_products.map((c) => c.url_key) });
    setBusy(false);
    if (ok) onAdded?.();
    else setErr(getCartState().error ?? 'Could not add to bag.');
  };

  const H = headingLevel === 1 ? 'h1' : 'h2';
  const price = variant ? variant.product.price_range : p.price_range;
  const noPrice = isGrouped;

  return (
    <div className="ts-buy" ref={boxRef}>
      <H>{p.name}</H>
      <div className="ts-buy__reviews">
        {p.review_count > 0 ? (
          <>
            <span className="ts-rating">
              <Stars pct={p.rating_summary} />
            </span>
            <a href="#reviews" onClick={() => window.dispatchEvent(new CustomEvent('ts:tab', { detail: 'reviews' }))}>
              {p.review_count} {p.review_count === 1 ? 'Review' : 'Reviews'}
            </a>
            {!compact && (
              <a className="ts-buy__add" href="#review-form" onClick={() => window.dispatchEvent(new CustomEvent('ts:tab', { detail: 'reviews' }))}>
                Add Your Review
              </a>
            )}
          </>
        ) : (
          !compact && (
            <a href="#review-form" onClick={() => window.dispatchEvent(new CustomEvent('ts:tab', { detail: 'reviews' }))}>
              Be the first to review this product
            </a>
          )
        )}
      </div>
      <div className={`ts-buy__price${noPrice ? ' ts-buy__price--noprice' : ''}`}>
        {!noPrice && (
          <div className="ts-buy__amount">
            {isBundle ? (
              <>
                <span className="ts-price-label">From</span>
                <Price pr={{ ...price, maximum_price: price.minimum_price }} />
                <span className="ts-dash">&ndash;</span>
                <span className="ts-price">{money(price.maximum_price.final_price.value)}</span>
              </>
            ) : isConf && !variant && price.maximum_price.final_price.value > price.minimum_price.final_price.value + 0.001 ? (
              <>
                <span className="ts-price-label">From</span>
                <span className="ts-price">{money(price.minimum_price.final_price.value)}</span>
              </>
            ) : (
              <Price pr={{ ...price, maximum_price: price.minimum_price }} />
            )}
          </div>
        )}
        <div className="ts-buy__meta">
          <span className={`ts-stock ${inStock ? 'ts-stock--in' : 'ts-stock--out'}`}>{inStock ? 'In stock' : 'Out of stock'}</span>
          {!compact && <span>SKU&nbsp;&nbsp;{sku}</span>}
        </div>
      </div>
      {onlyLeft != null && onlyLeft > 0 && <p style={{ color: 'var(--ts-clay)', fontWeight: 600, fontSize: 12.5, margin: '6px 0 0' }}>Only {onlyLeft} left</p>}
      {p.short_description?.html && <div className="ts-buy__overview" dangerouslySetInnerHTML={{ __html: p.short_description.html }} />}
      {!p.short_description?.html && <div style={{ height: 18 }} />}

      {isConf &&
        opts.map((o) => {
          const chosen = o.values.find((v) => v.uid === sel[o.attribute_code]);
          const color = o.values.some((v) => v.swatch_data?.__typename === 'ColorSwatchData');
          return (
            <fieldset className="ts-swatch-attr" key={o.attribute_code}>
              <legend>
                {o.label}
                <span className="ts-req" aria-hidden="true">*</span>
                {chosen && <span className="ts-sel">{chosen.label}</span>}
              </legend>
              <div className="ts-swatch-opts">
                {o.values.map((v) => {
                  const on = sel[o.attribute_code] === v.uid;
                  const ok = available(o.attribute_code, v.uid);
                  return (
                    <button
                      key={v.uid}
                      type="button"
                      className={`ts-swatch${color ? '' : ' ts-swatch--text'}${on ? ' is-on' : ''}${ok ? '' : ' is-off'}`}
                      style={color && v.swatch_data ? { background: v.swatch_data.value } : undefined}
                      aria-pressed={on}
                      aria-label={`${o.label}: ${v.label}${ok ? '' : ' (out of stock)'}`}
                      title={v.label}
                      onClick={() => {
                        if (!ok) return;
                        setHint(false);
                        setSel((s) => {
                          const n = { ...s };
                          if (on) delete n[o.attribute_code];
                          else n[o.attribute_code] = v.uid;
                          return n;
                        });
                      }}
                    >
                      {color ? '' : (v.swatch_data?.value ?? v.label)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      {hint && missing.length > 0 && <p className="ts-buy__hint" role="alert">Choose a {missing.map((m) => m.label.toLowerCase()).join(' and ')} first.</p>}

      {isBundle && (
        <div className="ts-bundle">
          {[...(p.bundle_items ?? [])]
            .sort((a, b) => a.position - b.position)
            .map((it) => {
              const multi = it.type === 'checkbox' || it.type === 'multi';
              return (
                <fieldset className="ts-bundle__opt" key={it.uid}>
                  <legend>
                    {it.title}
                    {it.required && <span className="ts-req" style={{ color: 'var(--ts-clay)', marginLeft: 3 }}>*</span>}
                  </legend>
                  {[...it.options]
                    .sort((a, b) => a.position - b.position)
                    .map((o) => {
                      const on = (bundle[it.uid] ?? []).includes(o.uid);
                      const pr = o.product?.price_range.minimum_price.final_price.value ?? o.price;
                      return (
                        <label key={o.uid} className={`ts-bundle__choice${on ? ' is-on' : ''}`}>
                          <input
                            type={multi ? 'checkbox' : 'radio'}
                            name={`b-${it.uid}`}
                            checked={on}
                            onChange={() =>
                              setBundle((b) => {
                                const cur = b[it.uid] ?? [];
                                if (multi) return { ...b, [it.uid]: on ? cur.filter((x) => x !== o.uid) : [...cur, o.uid] };
                                return { ...b, [it.uid]: [o.uid] };
                              })
                            }
                          />
                          <span>
                            {o.quantity > 1 ? `${o.quantity} x ` : ''}
                            {o.label}
                          </span>
                          <em>+{money(pr * (o.quantity || 1))}</em>
                        </label>
                      );
                    })}
                </fieldset>
              );
            })}
          <p className="ts-bundle__total">
            <span>Your set</span>
            <strong>{money(bundleTotal)}</strong>
          </p>
        </div>
      )}

      {isGrouped && (
        <ul className="ts-grouped">
          {[...(p.grouped_items ?? [])]
            .sort((a, b) => a.position - b.position)
            .map((g) => {
              const src = mediaSrc(g.product.small_image?.url);
              const out = g.product.stock_status !== 'IN_STOCK';
              return (
                <li key={g.product.sku}>
                  <span className="ts-grouped__img">{src && <Image src={src} alt="" fill sizes="64px" />}</span>
                  <div className="ts-grouped__info">
                    <span className="ts-grouped__name">{g.product.name}</span>
                    <Price pr={g.product.price_range} />
                  </div>
                  {out ? (
                    <span className="ts-stock ts-stock--out">Out of stock</span>
                  ) : (
                    <Qty small value={grouped[g.product.sku] ?? 0} label={`Quantity for ${g.product.name}`} onChange={(n) => setGrouped((s) => ({ ...s, [g.product.sku]: n }))} />
                  )}
                </li>
              );
            })}
        </ul>
      )}

      {inStock ? (
        <div className="ts-tocart">
          {!isGrouped && <Qty value={qty} onChange={setQty} />}
          <button ref={btnRef} type="button" className="ts-button" onClick={add} disabled={busy} aria-busy={busy}>
            {busy ? (
              <>
                Adding <span className="ts-spinner" style={{ marginLeft: 10, width: 16, height: 16 }} />
              </>
            ) : (
              'Add to bag'
            )}
          </button>
        </div>
      ) : (
        <p className="ts-msg ts-msg--info" style={{ marginTop: 12 }}>This item is out of stock right now.</p>
      )}
      {err && (
        <p className="ts-msg ts-msg--error" role="alert">
          {err}
        </p>
      )}
      <SaveButton urlKey={p.url_key} name={p.name} className="ts-buy__save" />
      {compact ? (
        <p style={{ marginTop: 6 }}>
          <Link className="ts-textlink" href={`/${p.url_key}.html`}>
            View full details
          </Link>
        </p>
      ) : (
        usps
      )}

      {!compact && inStock && (
        <div className={`ts-sticky-atc${sticky ? ' is-visible' : ''}`} aria-hidden={!sticky} inert={!sticky}>
          <div className="ts-sticky-atc__info">
            <span className="ts-sticky-atc__name">{p.name}</span>
            <span className="ts-sticky-atc__price">
              {isGrouped ? 'Set of items' : money(isBundle ? bundleTotal : price.minimum_price.final_price.value)}
            </span>
          </div>
          <button type="button" className="ts-button" onClick={add} disabled={busy}>
            {busy ? 'Adding' : isConf && missing.length ? 'Choose options' : 'Add to bag'}
          </button>
        </div>
      )}
    </div>
  );
}
