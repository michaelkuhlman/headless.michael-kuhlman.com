'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AccountShell, useCustomer } from './AccountShell';
import { AddrBlock } from './AccountOrders';
import { AddressFields, emptyAddr, fromCart, validateAddr, type Addr, type AddrErrors } from '../checkout/AddressForm';
import { gql } from '@/lib/client/gql';
import { logout, useAuth } from '@/lib/client/auth';
import { regionName } from '../checkout/AddressForm';
import type { Region } from '@/lib/magento/catalog';

/** Account information, address book and newsletter pages. */

const REQ = 'This is a required field.';

function Msg({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return (
    <p className={`ts-alert${m.ok ? ' ts-alert--ok' : ''}`} role={m.ok ? 'status' : 'alert'}>
      {m.text}
    </p>
  );
}

export function EditInfo() {
  const sp = useSearchParams();
  const { data } = useCustomer<{ customer: { firstname: string; lastname: string; email: string } }>(`{ customer { firstname lastname email } }`);
  const [f, setF] = useState({ firstname: '', lastname: '', email: '', current: '', pw: '', pw2: '' });
  const [chEmail, setChEmail] = useState(false);
  const [chPass, setChPass] = useState(sp.get('changepass') === '1');
  const [err, setErr] = useState<Partial<Record<keyof typeof f, string>>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setF((x) => ({ ...x, firstname: data.customer.firstname, lastname: data.customer.lastname, email: data.customer.email }));
  }, [data]);
  const field = (k: keyof typeof f, label: string, type = 'text', ac?: string) => (
    <div className="ts-field is-required">
      <label htmlFor={`e-${k}`}>{label}</label>
      <input id={`e-${k}`} type={type} value={f[k]} autoComplete={ac} aria-invalid={!!err[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
      {err[k] && <p className="ts-field-error">{err[k]}</p>}
    </div>
  );
  return (
    <AccountShell title="Edit Account Information">
      <Msg m={msg} />
      <form
        className="ts-acct__form"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const x: typeof err = {};
          if (!f.firstname.trim()) x.firstname = REQ;
          if (!f.lastname.trim()) x.lastname = REQ;
          if (chEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) x.email = 'Please enter a valid email address (Ex: johndoe@domain.com).';
          if ((chEmail || chPass) && !f.current) x.current = REQ;
          if (chPass && f.pw.length < 8) x.pw = 'Minimum length of this field must be equal or greater than 8 symbols.';
          if (chPass && f.pw2 !== f.pw) x.pw2 = 'Please enter the same value again.';
          setErr(x);
          if (Object.keys(x).length) return;
          setBusy(true);
          setMsg(null);
          try {
            await gql(`mutation ($i: CustomerUpdateInput!) { updateCustomerV2(input: $i) { customer { firstname } } }`, {
              i: { firstname: f.firstname.trim(), lastname: f.lastname.trim() },
            });
            if (chEmail && f.email.trim() !== data?.customer.email)
              await gql(`mutation ($e: String!, $p: String!) { updateCustomerEmail(email: $e, password: $p) { customer { email } } }`, { e: f.email.trim(), p: f.current });
            if (chPass) await gql(`mutation ($c: String!, $n: String!) { changeCustomerPassword(currentPassword: $c, newPassword: $n) { email } }`, { c: f.current, n: f.pw });
            document.cookie = `hl_auth=${encodeURIComponent(f.firstname.trim())}; Path=/; Max-Age=${60 * 60 * 24 * 7}; Secure; SameSite=Lax`;
            setF((v) => ({ ...v, current: '', pw: '', pw2: '' }));
            setChPass(false);
            setChEmail(false);
            setMsg({ ok: true, text: 'You saved the account information.' });
          } catch (x2) {
            setMsg({ ok: false, text: x2 instanceof Error ? x2.message : 'Could not save your changes.' });
          }
          setBusy(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      >
        <section className="ts-card-box">
          <h2>Account Information</h2>
          {field('firstname', 'First name', 'text', 'given-name')}
          {field('lastname', 'Last name', 'text', 'family-name')}
          <label className="ts-check">
            <input type="checkbox" checked={chEmail} onChange={(e) => setChEmail(e.target.checked)} />
            Change Email
          </label>
          <label className="ts-check">
            <input type="checkbox" checked={chPass} onChange={(e) => setChPass(e.target.checked)} />
            Change Password
          </label>
        </section>
        {(chEmail || chPass) && (
          <section className="ts-card-box">
            <h2>{chEmail && chPass ? 'Change Email and Password' : chEmail ? 'Change Email' : 'Change Password'}</h2>
            {chEmail && field('email', 'Email', 'email', 'email')}
            {field('current', 'Current Password', 'password', 'current-password')}
            {chPass && field('pw', 'New Password', 'password', 'new-password')}
            {chPass && field('pw2', 'Confirm New Password', 'password', 'new-password')}
          </section>
        )}
        <div className="ts-actions">
          <button type="submit" className="ts-button" disabled={busy || !data}>
            Save
          </button>
        </div>
      </form>
    </AccountShell>
  );
}

interface CAddr {
  uid: string;
  firstname: string;
  lastname: string;
  company: string | null;
  street: string[];
  city: string;
  postcode: string;
  telephone: string | null;
  region: { region_id: number; region: string } | null;
  default_billing: boolean;
  default_shipping: boolean;
}

export function AddressBook({ regions }: { regions: Region[] }) {
  const { data, reload } = useCustomer<{ customer: { firstname: string; lastname: string; addresses: CAddr[] } }>(
    `{ customer { firstname lastname addresses { uid firstname lastname company street city postcode telephone region { region_id region } default_billing default_shipping } } }`,
  );
  const [edit, setEdit] = useState<CAddr | 'new' | null>(null);
  const [a, setA] = useState<Addr>({ ...emptyAddr });
  const [defs, setDefs] = useState({ billing: false, shipping: false });
  const [err, setErr] = useState<AddrErrors>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const list = data?.customer.addresses ?? [];

  const open = (x: CAddr | 'new') => {
    setEdit(x);
    setErr({});
    setMsg(null);
    if (x === 'new') {
      // like the classic store, a new address starts with the account holder's name
      setA({ ...emptyAddr, firstname: data?.customer.firstname ?? '', lastname: data?.customer.lastname ?? '' });
      setDefs({ billing: !list.length, shipping: !list.length });
    } else {
      setA(fromCart({ ...x, region: { region_id: x.region?.region_id ?? null, code: null, label: null } }));
      setDefs({ billing: x.default_billing, shipping: x.default_shipping });
    }
  };

  if (edit) {
    return (
      <AccountShell title={edit === 'new' ? 'Add New Address' : 'Edit Address'}>
        <Msg m={msg} />
        <form
          className="ts-acct__form"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const x = validateAddr(a);
            setErr(x);
            if (Object.keys(x).length) return;
            setBusy(true);
            const input = {
              firstname: a.firstname.trim(),
              lastname: a.lastname.trim(),
              company: a.company.trim() || null,
              street: [a.street1.trim(), a.street2.trim()].filter(Boolean),
              city: a.city.trim(),
              region: { region_id: Number(a.region_id), region: regionName(regions, a.region_id) },
              postcode: a.postcode.trim(),
              country_code: 'US',
              telephone: a.telephone.trim(),
              default_billing: defs.billing,
              default_shipping: defs.shipping,
            };
            try {
              if (edit === 'new') await gql(`mutation ($i: CustomerAddressInput!) { createCustomerAddress(input: $i) { uid } }`, { i: input });
              else await gql(`mutation ($u: ID!, $i: CustomerAddressInput!) { updateCustomerAddressV2(uid: $u, input: $i) { uid } }`, { u: edit.uid, i: input });
              setEdit(null);
              setMsg({ ok: true, text: 'You saved the address.' });
              reload();
            } catch (x2) {
              setMsg({ ok: false, text: x2 instanceof Error ? x2.message : 'Could not save the address.' });
            }
            setBusy(false);
          }}
        >
          <section className="ts-card-box">
            <h2>Contact and Address</h2>
            <AddressFields id="ab" a={a} set={setA} err={err} regions={regions} />
            <label className="ts-check">
              <input type="checkbox" checked={defs.billing} onChange={(e) => setDefs({ ...defs, billing: e.target.checked })} />
              Use as my default billing address
            </label>
            <label className="ts-check">
              <input type="checkbox" checked={defs.shipping} onChange={(e) => setDefs({ ...defs, shipping: e.target.checked })} />
              Use as my default shipping address
            </label>
          </section>
          <div className="ts-actions">
            <button type="submit" className="ts-button" disabled={busy}>
              Save Address
            </button>
            <button type="button" className="ts-textlink" onClick={() => setEdit(null)}>
              Go back
            </button>
          </div>
        </form>
      </AccountShell>
    );
  }

  const blk = (x: CAddr) => ({ ...x, region: x.region?.region ?? '' });
  const others = list.filter((x) => !x.default_billing && !x.default_shipping);
  const bill = list.find((x) => x.default_billing);
  const ship = list.find((x) => x.default_shipping);
  return (
    <AccountShell title="Address Book">
      <Msg m={msg} />
      {!data ? (
        <div className="ts-acct__skeleton" aria-busy="true" />
      ) : (
        <>
          <h2>Default Addresses</h2>
          <div className="ts-acct__grid">
            <div className="ts-card-box">
              <h3>Default Billing Address</h3>
              <AddrBlock a={bill ? blk(bill) : null} />
              {bill && (
                <p className="ts-acct__links">
                  <button type="button" className="ts-textlink" onClick={() => open(bill)}>
                    Change Billing Address
                  </button>
                </p>
              )}
            </div>
            <div className="ts-card-box">
              <h3>Default Shipping Address</h3>
              <AddrBlock a={ship ? blk(ship) : null} />
              {ship && (
                <p className="ts-acct__links">
                  <button type="button" className="ts-textlink" onClick={() => open(ship)}>
                    Change Shipping Address
                  </button>
                </p>
              )}
            </div>
          </div>
          <h2>Additional Address Entries</h2>
          {others.length === 0 ? (
            <p className="ts-acct__empty">You have no other address entries in your address book.</p>
          ) : (
            <div className="ts-acct__grid">
              {others.map((x) => (
                <div className="ts-card-box" key={x.uid}>
                  <AddrBlock a={blk(x)} />
                  <p className="ts-acct__links">
                    <button type="button" className="ts-textlink" onClick={() => open(x)}>
                      Edit Address
                    </button>
                    <button
                      type="button"
                      className="ts-textlink ts-textlink--danger"
                      onClick={async () => {
                        if (!confirm('Are you sure you want to delete this address?')) return;
                        await gql(`mutation ($u: ID!) { deleteCustomerAddressV2(uid: $u) }`, { u: x.uid }).catch(() => {});
                        reload();
                      }}
                    >
                      Delete Address
                    </button>
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="ts-actions">
            <button type="button" className="ts-button" onClick={() => open('new')}>
              Add New Address
            </button>
          </div>
        </>
      )}
    </AccountShell>
  );
}

export function Newsletter() {
  const { data } = useCustomer<{ customer: { is_subscribed: boolean } }>(`{ customer { is_subscribed } }`);
  const [on, setOn] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const val = on ?? data?.customer.is_subscribed ?? false;
  return (
    <AccountShell title="Newsletter Subscription">
      <Msg m={msg} />
      <form
        className="ts-acct__form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await gql(`mutation ($s: Boolean!) { updateCustomerV2(input: { is_subscribed: $s }) { customer { is_subscribed } } }`, { s: val });
            setMsg({ ok: true, text: val ? 'We have saved your subscription.' : 'We have updated your subscription.' });
          } catch (x) {
            setMsg({ ok: false, text: x instanceof Error ? x.message : 'Could not save.' });
          }
          setBusy(false);
        }}
      >
        <section className="ts-card-box">
          <h2>Subscription option</h2>
          <label className="ts-check">
            <input type="checkbox" checked={val} disabled={!data} onChange={(e) => setOn(e.target.checked)} />
            General Subscription
          </label>
          <p className="ts-muted">Demo store: subscriptions are saved in Magento, but no emails are ever sent.</p>
        </section>
        <div className="ts-actions">
          <button type="submit" className="ts-button" disabled={busy || !data}>
            Save
          </button>
        </div>
      </form>
    </AccountShell>
  );
}

export function LogoutView() {
  const router = useRouter();
  const auth = useAuth();
  useEffect(() => {
    if (auth.loggedIn) void logout();
  }, [auth.loggedIn]);
  useEffect(() => {
    const t = setTimeout(() => router.replace('/'), 5000);
    return () => clearTimeout(t);
  }, [router]);
  return (
    <div className="ts-entry-title ts-logout">
      <h1>You are signed out</h1>
      <p>You have signed out and will go to our homepage in 5 seconds.</p>
    </div>
  );
}
