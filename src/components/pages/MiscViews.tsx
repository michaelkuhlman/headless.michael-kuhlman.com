'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Breadcrumbs } from '../Breadcrumbs';
import { Listing } from '../catalog/Listing';
import { ProductGrid } from '../ProductCard';
import { OrderDetail, ORDER_FIELDS, type OrderFull } from '../account/AccountOrders';
import { saved, recentSearches } from '@/lib/client/lists';
import { gql } from '@/lib/client/gql';
import type { ProductCard, ProductListResult } from '@/lib/magento/types';

/** Search results, saved items, contact form and guest order lookup. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REQ = 'This is a required field.';

function swatchesOf(res: ProductListResult): Record<string, string> {
  const m: Record<string, string> = {};
  for (const p of res.items) for (const o of p.configurable_options ?? []) for (const v of o.values) if (v.swatch_data?.__typename === 'ColorSwatchData') m[v.label] = v.swatch_data.value;
  return m;
}

export function SearchView({ labels }: { labels: Record<string, string> }) {
  const q = (useSearchParams().get('q') ?? '').trim().slice(0, 80);
  const [res, setRes] = useState<ProductListResult | null>(null);
  useEffect(() => {
    if (!q) return;
    let live = true;
    setRes(null);
    recentSearches.add(q);
    fetch(`/api/listing?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((j: ProductListResult) => live && setRes(j))
      .catch(() => live && setRes({ total_count: 0, items: [], aggregations: [], page_info: { current_page: 1, page_size: 60, total_pages: 0 } } as ProductListResult));
    return () => {
      live = false;
    };
  }, [q]);
  return (
    <div className="ts-results">
      <Breadcrumbs items={[{ label: `Search results for: ‘${q}’` }]} />
      <h1 className="ts-results__title">Search results for: &lsquo;{q}&rsquo;</h1>
      {!q ? (
        <p className="ts-alert">Please enter a search term.</p>
      ) : !res ? (
        <div className="ts-grid ts-results__skeleton" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      ) : res.total_count === 0 ? (
        <div className="ts-results__none">
          <p className="ts-alert">Your search returned no results.</p>
          <p>
            Try a shorter word, or browse <Link href="/paddles.html">paddles</Link>, <Link href="/balls.html">balls</Link> or{' '}
            <Link href="/search/term/popular/">popular searches</Link>.
          </p>
        </div>
      ) : (
        <Listing key={q} initial={res} search={q.toLowerCase()} swatches={swatchesOf(res)} labels={labels} />
      )}
    </div>
  );
}

export function SavedView() {
  const keys = saved.use();
  const [items, setItems] = useState<ProductCard[] | null>(null);
  const sig = keys.join(',');
  useEffect(() => {
    if (!sig) {
      setItems([]);
      return;
    }
    let live = true;
    fetch(`/api/cards?keys=${encodeURIComponent(sig)}`)
      .then((r) => r.json())
      .then((j: { items: ProductCard[] }) => live && setItems(j.items))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [sig]);
  return (
    <div className="ts-saved">
      <h1>Saved items</h1>
      <p className="ts-saved__intro">Tap the heart on any product to keep it here. Saved items stay in this browser, no account needed.</p>
      {items === null ? (
        <div className="ts-grid ts-results__skeleton" aria-busy="true">
          {Array.from({ length: Math.min(4, keys.length || 4) }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="ts-saved__empty">
          <p className="ts-saved__empty-title">Nothing saved yet</p>
          <p>Browse the shop and tap the heart on anything you want to come back to.</p>
          <Link className="ts-btn" href="/paddles.html">
            Shop paddles
          </Link>
        </div>
      ) : (
        <>
          <ProductGrid items={items} cols={4} />
          <p className="ts-saved__foot">
            <button type="button" className="ts-textlink" onClick={() => saved.clear()}>
              Clear saved items
            </button>
          </p>
        </>
      )}
    </div>
  );
}

export function ContactForm() {
  const [f, setF] = useState({ name: '', email: '', telephone: '', comment: '' });
  const [err, setErr] = useState<Partial<Record<keyof typeof f, string>>>({});
  const [done, setDone] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fld = (k: keyof typeof f, label: string, opt = false, type = 'text', ac?: string) => (
    <div className={`ts-field${opt ? '' : ' is-required'}`}>
      <label htmlFor={`ct-${k}`}>
        {label} {opt && <span className="ts-optional">optional</span>}
      </label>
      {k === 'comment' ? (
        <textarea id="ct-comment" rows={5} value={f.comment} placeholder="Which paddle, which order, what question?" aria-invalid={!!err.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} />
      ) : (
        <input id={`ct-${k}`} type={type} value={f[k]} autoComplete={ac} aria-invalid={!!err[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
      )}
      {err[k] && <p className="ts-field-error">{err[k]}</p>}
    </div>
  );
  return (
    <form
      className="ts-contact-form"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const x: typeof err = {};
        if (!f.name.trim()) x.name = REQ;
        if (!f.email.trim()) x.email = REQ;
        else if (!EMAIL_RE.test(f.email.trim())) x.email = 'Please enter a valid email address (Ex: johndoe@domain.com).';
        if (!f.comment.trim()) x.comment = REQ;
        setErr(x);
        if (Object.keys(x).length) return;
        setBusy(true);
        try {
          await gql(`mutation ($i: ContactUsInput!) { contactUs(input: $i) { status } }`, {
            i: { name: f.name.trim(), email: f.email.trim(), telephone: f.telephone.trim(), comment: f.comment.trim() },
          });
          setDone({ ok: true, text: "Thanks for contacting us with your comments and questions. We'll respond to you very soon." });
          setF({ name: '', email: '', telephone: '', comment: '' });
        } catch (x2) {
          setDone({ ok: false, text: x2 instanceof Error ? x2.message : 'We could not send your message. Please try again.' });
        }
        setBusy(false);
      }}
    >
      <h2>Send a message</h2>
      {done && (
        <p className={`ts-alert${done.ok ? ' ts-alert--ok' : ''}`} role={done.ok ? 'status' : 'alert'}>
          {done.text}
        </p>
      )}
      {fld('name', 'Name', false, 'text', 'name')}
      {fld('email', 'Email', false, 'email', 'email')}
      {fld('telephone', 'Phone', true, 'tel', 'tel')}
      {fld('comment', 'Message')}
      <button type="submit" className="ts-button" disabled={busy}>
        {busy ? 'Sending' : 'Send message'}
      </button>
    </form>
  );
}

export function GuestOrderView() {
  const [f, setF] = useState({ number: '', lastname: '', email: '' });
  const [err, setErr] = useState<Partial<Record<keyof typeof f, string>>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderFull | null>(null);
  const [busy, setBusy] = useState(false);
  if (order) {
    return (
      <div className="ts-guest-order">
        <div className="ts-entry-title">
          <h1>Order # {order.number}</h1>
        </div>
        <OrderDetail o={order} guest />
        <button type="button" className="ts-textlink ts-back" onClick={() => setOrder(null)}>
          Look up another order
        </button>
      </div>
    );
  }
  const fld = (k: keyof typeof f, label: string, type = 'text', ac?: string) => (
    <div className="ts-field is-required">
      <label htmlFor={`go-${k}`}>{label}</label>
      <input id={`go-${k}`} type={type} value={f[k]} autoComplete={ac} aria-invalid={!!err[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
      {err[k] && <p className="ts-field-error">{err[k]}</p>}
    </div>
  );
  return (
    <>
      <div className="ts-entry-title">
        <h1>Order status</h1>
      </div>
      <form
        className="ts-entry-form"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const x: typeof err = {};
          for (const k of ['number', 'lastname', 'email'] as const) if (!f[k].trim()) x[k] = REQ;
          if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) x.email = 'Please enter a valid email address (Ex: johndoe@domain.com).';
          setErr(x);
          if (Object.keys(x).length) return;
          setBusy(true);
          setMsg(null);
          try {
            const d = await gql<{ guestOrder: OrderFull }>(`query ($i: GuestOrderInformationInput!) { guestOrder(input: $i) { ${ORDER_FIELDS} } }`, {
              i: { number: f.number.trim(), lastname: f.lastname.trim(), email: f.email.trim() },
            });
            setOrder(d.guestOrder);
          } catch {
            setMsg('You entered incorrect data. Please try again.');
          }
          setBusy(false);
        }}
      >
        {msg && (
          <p className="ts-alert" role="alert">
            {msg}
          </p>
        )}
        <section className="ts-card-box">
          <h2>Order information</h2>
          {fld('number', 'Order ID')}
          {fld('lastname', 'Billing last name', 'text', 'family-name')}
          {fld('email', 'Email', 'email', 'email')}
          <div className="ts-actions">
            <button type="submit" className="ts-button" disabled={busy}>
              Continue
            </button>
          </div>
        </section>
      </form>
    </>
  );
}
