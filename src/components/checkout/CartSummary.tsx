'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { ShipMeter } from '../BagDrawer';
import { applyCoupon, removeCoupon, type Cart } from '@/lib/client/cart';
import { gql } from '@/lib/client/gql';
import { money } from '@/lib/format';
import type { Region } from '@/lib/magento/catalog';

interface Rate {
  carrier_code: string;
  method_code: string;
  carrier_title: string;
  method_title: string;
  amount: { value: number };
  available: boolean;
}

/** "Apply a discount code" accordion (bag page and checkout payment step). */
export function DiscountBox({ cart }: { cart: Cart }) {
  const applied = cart.applied_coupons?.[0]?.code ?? null;
  const [open, setOpen] = useState(!!applied);
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="ts-disc">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        Apply a discount code
        <Icon name="chevD" />
      </button>
      {open &&
        (applied ? (
          <div className="ts-applied">
            <span>
              Code <strong>{applied}</strong> applied.
            </span>
            <button
              type="button"
              className="ts-textlink"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await removeCoupon().catch(() => {});
                setBusy(false);
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!code.trim()) return;
              setBusy(true);
              const m = await applyCoupon(code.trim());
              setBusy(false);
              setErr(m);
              if (!m) setCode('');
            }}
          >
            <div>
              <label className="sr-only" htmlFor="ts-coupon">
                Discount code
              </label>
              <input id="ts-coupon" type="text" placeholder="Enter discount code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
              {err && (
                <p className="ts-field-error" role="alert">
                  {err}
                </p>
              )}
            </div>
            <button type="submit" className="ts-button ts-button--ghost" disabled={busy}>
              Apply
            </button>
          </form>
        ))}
    </div>
  );
}

/** Totals rows shared by the bag summary and the checkout order summary. */
export function Totals({ cart, shipping, grandOverride }: { cart: Cart; shipping?: { label: string; note?: string; amount: number } | null; grandOverride?: number | null }) {
  const p = cart.prices;
  const discounts = p.discounts ?? [];
  const taxes = p.applied_taxes ?? [];
  return (
    <table className="ts-totals">
      <tbody>
        <tr>
          <th scope="row">{shipping === undefined ? 'Subtotal' : 'Bag subtotal'}</th>
          <td>{money(p.subtotal_excluding_tax.value)}</td>
        </tr>
        {discounts.map((d, i) => (
          <tr key={i} className="is-disc">
            <th scope="row">{d.label || 'Discount'}</th>
            <td>-{money(d.amount.value)}</td>
          </tr>
        ))}
        {shipping && (
          <tr>
            <th scope="row">
              {shipping.label}
              {shipping.note && <small>{shipping.note}</small>}
            </th>
            <td>{money(shipping.amount)}</td>
          </tr>
        )}
        {taxes.map((t, i) => (
          <tr key={`t${i}`}>
            <th scope="row">{t.label || 'Tax'}</th>
            <td>{money(t.amount.value)}</td>
          </tr>
        ))}
        <tr className="is-grand">
          <th scope="row">Order total</th>
          <td>{money(grandOverride ?? p.grand_total.value)}</td>
        </tr>
      </tbody>
    </table>
  );
}

/** Estimate shipping and tax: Magento's estimateShippingMethods / estimateTotals, nothing is saved on the cart. */
function Estimate({ cart, regions, onPick }: { cart: Cart; regions: Region[]; onPick: (r: { rate: Rate; total: number } | null) => void }) {
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState('');
  const [zip, setZip] = useState('');
  const [rates, setRates] = useState<Rate[] | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const address = () => {
    const r = regions.find((x) => String(x.id) === region);
    return { country_code: 'US', postcode: zip || undefined, region: r ? { region_id: r.id, region_code: r.code, region: r.name } : undefined };
  };

  // keepPick: a cart change re-quotes the rates (free shipping can appear or vanish) and the chosen method's total
  const load = async (keepPick = false) => {
    setBusy(true);
    setErr(null);
    try {
      const d = await gql<{ estimateShippingMethods: Rate[] }>(
        `mutation ($in: EstimateTotalsInput!) { estimateShippingMethods(input: $in) { carrier_code method_code carrier_title method_title amount { value } available } }`,
        { in: { cart_id: cart.id, address: address() } },
      );
      const list = d.estimateShippingMethods.filter((r) => r.available);
      setRates(list);
      const again = keepPick ? list.find((r) => `${r.carrier_code}_${r.method_code}` === pick) : undefined;
      if (again) void choose(again);
      else {
        setPick(null);
        onPick(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not estimate shipping.');
      setPick(null);
      onPick(null);
    }
    setBusy(false);
  };

  const sig = `${cart.prices.grand_total.value}|${cart.items.map((i) => `${i.uid}:${i.quantity}`).join(',')}`;
  const lastSig = useRef(sig);
  useEffect(() => {
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    if (rates) void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const choose = async (r: Rate) => {
    const id = `${r.carrier_code}_${r.method_code}`;
    setPick(id);
    try {
      const d = await gql<{ estimateTotals: { cart: { prices: { grand_total: { value: number } } } } }>(
        `mutation ($in: EstimateTotalsInput!) { estimateTotals(input: $in) { cart { prices { grand_total { value } } } } }`,
        { in: { cart_id: cart.id, address: address(), shipping_method: { carrier_code: r.carrier_code, method_code: r.method_code } } },
      );
      onPick({ rate: r, total: d.estimateTotals.cart.prices.grand_total.value });
    } catch {
      onPick({ rate: r, total: cart.prices.grand_total.value + r.amount.value });
    }
  };

  return (
    <div className="ts-est">
      <button type="button" className="ts-est__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        Estimate shipping and tax
        <Icon name="chevD" />
      </button>
      {open && (
        <div className="ts-est__body">
          <div className="ts-field">
            <label htmlFor="ts-est-country">Country</label>
            <select id="ts-est-country" value="US" disabled>
              <option value="US">United States</option>
            </select>
          </div>
          <div className="ts-field">
            <label htmlFor="ts-est-region">State/Province</label>
            <select id="ts-est-region" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">Please select a region, state or province.</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="ts-field">
            <label htmlFor="ts-est-zip">ZIP / postal code</label>
            <input id="ts-est-zip" type="text" inputMode="numeric" autoComplete="postal-code" value={zip} onChange={(e) => setZip(e.target.value)} />
          </div>
          <button type="button" className="ts-button ts-button--ghost ts-button--sm" onClick={() => load()} disabled={busy}>
            {busy ? 'Checking' : 'Get rates'}
          </button>
          {err && <p className="ts-field-error">{err}</p>}
          {rates && (
            <div className="ts-est__rates" role="radiogroup" aria-label="Shipping methods">
              {rates.length === 0 && <p>No shipping methods for this address.</p>}
              {rates.map((r) => {
                const id = `${r.carrier_code}_${r.method_code}`;
                return (
                  <label key={id} className={`ts-method${pick === id ? ' is-on' : ''}`}>
                    <input type="radio" name="ts-est-rate" checked={pick === id} onChange={() => choose(r)} />
                    <span className="ts-method__price">{money(r.amount.value)}</span>
                    <span className="ts-method__name">{r.carrier_title}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CartSummary({ cart, regions }: { cart: Cart; regions: Region[] }) {
  const [est, setEst] = useState<{ rate: Rate; total: number } | null>(null);
  const subtotal = cart.prices.subtotal_including_tax.value;
  return (
    <aside className="ts-summary" aria-label="Order summary">
      <ShipMeter subtotal={subtotal} />
      <h2>Summary</h2>
      <Estimate cart={cart} regions={regions} onPick={setEst} />
      <Totals cart={cart} shipping={est ? { label: 'Shipping', note: `${est.rate.carrier_title} - ${est.rate.method_title}`, amount: est.rate.amount.value } : undefined} grandOverride={est?.total ?? null} />
      <Link className="ts-button ts-button--block" href="/checkout/" prefetch>
        Checkout
      </Link>
    </aside>
  );
}
