'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { DiscountBox } from './CartSummary';
import { OrderSummary } from './OrderSummary';
import { AddressFields, AddressView, emptyAddr, fromCart, toCartInput, validateAddr, type Addr, type AddrErrors } from './AddressForm';
import { useAuth } from '@/lib/client/auth';
import { CART_FIELDS, clearCart, loadCart, setCart, useCart, type Cart, type ShippingMethod } from '@/lib/client/cart';
import { gql } from '@/lib/client/gql';
import { money } from '@/lib/format';
import type { Region } from '@/lib/magento/catalog';

/*
 * Two-step checkout like Luma's (Shipping, then Review & Payments) on Magento's GraphQL cart API. The shipping step
 * saves email, address, method, billing-same and the payment method in ONE request (GraphQL runs mutation fields in
 * order), and placing the order is a second; Luma's checkout makes a dozen REST calls for the same flow.
 */

type Step = 'shipping' | 'payment';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const rateId = (m: { carrier_code: string; method_code: string }) => `${m.carrier_code}_${m.method_code}`;

interface Customer {
  email: string;
  firstname: string;
  lastname: string;
  addresses: (Parameters<typeof fromCart>[0] & { default_shipping: boolean })[];
}

export function CheckoutView({ regions }: { regions: Region[] }) {
  const router = useRouter();
  const auth = useAuth();
  const { cart, ready } = useCart();
  const [step, setStep] = useState<Step>('shipping');
  const [email, setEmail] = useState('');
  const [ship, setShip] = useState<Addr>({ ...emptyAddr });
  const [err, setErr] = useState<AddrErrors & { email?: string; method?: string }>({});
  const tried = useRef(false);
  const [rates, setRates] = useState<ShippingMethod[] | null>(null);
  const [rate, setRate] = useState<string | null>(null);
  const [billSame, setBillSame] = useState(true);
  const [bill, setBill] = useState<Addr>({ ...emptyAddr });
  const [billErr, setBillErr] = useState<AddrErrors>({});
  const [pay, setPay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string | null>(null);
  const [mobSum, setMobSum] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const seeded = useRef(false);
  const placed = useRef(false);

  // Empty bag: back to the bag page (not after placing an order, the success page takes over).
  useEffect(() => {
    if (ready && !placed.current && (!cart || !cart.items.length)) router.replace('/checkout/cart/');
  }, [ready, cart, router]);

  // Seed the form once from the cart (resumed checkout) or the customer's default address.
  useEffect(() => {
    if (!ready || !cart || seeded.current) return;
    seeded.current = true;
    const sa = cart.shipping_addresses?.[0];
    if (sa) setShip(fromCart(sa));
    if (cart.email) setEmail(cart.email);
    if (sa?.selected_shipping_method) setRate(rateId(sa.selected_shipping_method));
  }, [ready, cart]);

  useEffect(() => {
    if (!auth.loggedIn) return;
    let live = true;
    gql<{ customer: Customer }>(
      `{ customer { email firstname lastname addresses { firstname lastname company street city postcode telephone region { region_id } default_shipping } } }`,
    )
      .then((d) => {
        if (!live) return;
        setCustomer(d.customer);
        setEmail(d.customer.email);
        const def = d.customer.addresses.find((a) => a.default_shipping) ?? d.customer.addresses[0];
        setShip((cur) =>
          cur.street1 ? cur : def ? fromCart(def) : { ...cur, firstname: cur.firstname || d.customer.firstname, lastname: cur.lastname || d.customer.lastname },
        );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [auth.loggedIn]);

  // Live shipping rates for what is typed so far (estimateShippingMethods saves nothing on the cart).
  const estKey = `${ship.region_id}|${/^\d{5}/.test(ship.postcode) ? ship.postcode.slice(0, 5) : ''}|${cart?.prices.subtotal_including_tax.value ?? 0}`;
  useEffect(() => {
    if (!cart?.id) return;
    let live = true;
    const t = setTimeout(async () => {
      const [rid, zip] = estKey.split('|');
      const r = regions.find((x) => String(x.id) === rid);
      try {
        const d = await gql<{ estimateShippingMethods: ShippingMethod[] }>(
          `mutation ($in: EstimateTotalsInput!) { estimateShippingMethods(input: $in) { carrier_code method_code carrier_title method_title amount { value } available error_message } }`,
          { in: { cart_id: cart.id, address: { country_code: 'US', postcode: zip || undefined, region: r ? { region_id: r.id, region_code: r.code } : undefined } } },
        );
        if (!live) return;
        const list = d.estimateShippingMethods.filter((m) => m.available !== false).sort((a, b) => a.amount.value - b.amount.value);
        setRates(list);
        setRate((cur) => (cur && list.some((m) => rateId(m) === cur) ? cur : list[0] ? rateId(list[0]) : null));
      } catch {
        if (live) setRates((cur) => cur ?? []);
      }
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [estKey, cart?.id, regions]);

  const selected = useMemo(() => {
    const sa = cart?.shipping_addresses?.[0];
    if (step === 'payment' && sa?.selected_shipping_method) return sa.selected_shipping_method;
    return null;
  }, [cart, step]);

  const checkShip = () => {
    const e: AddrErrors & { email?: string; method?: string } = validateAddr(ship);
    if (!auth.loggedIn && !EMAIL_RE.test(email.trim())) e.email = email.trim() ? 'Please enter a valid email address (Ex: johndoe@domain.com).' : 'This is a required field.';
    if (!rates?.some((x) => rateId(x) === rate)) e.method = 'The shipping method is missing. Select the shipping method and try again.';
    return e;
  };
  // after the first Next press, errors follow the fields live (they clear as soon as a field is fixed)
  useEffect(() => {
    if (tried.current) setErr(checkShip());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ship, email, rate, rates]);

  if (!ready || !cart || !cart.items.length) {
    return (
      <div className="ts-co-page">
        <CoHeader />
        <div className="ts-container">
          <div className="ts-co" aria-busy="true">
            <div className="ts-co__step ts-co__loading">Loading checkout</div>
          </div>
        </div>
        <CoFooter />
      </div>
    );
  }

  const goPayment = async () => {
    const e = checkShip();
    const m = rates?.find((x) => rateId(x) === rate);
    tried.current = true;
    setErr(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"], .ts-co__method-err')?.focus?.());
      return;
    }
    setBusy(true);
    setFail(null);
    const guest = !auth.loggedIn;
    try {
      const d = await gql<{ pay: { cart: Cart } }>(
        `mutation ($id: String!, ${guest ? '$email: String!, ' : ''}$addr: CartAddressInput!, $m: ShippingMethodInput!) {
          ${guest ? 'e: setGuestEmailOnCart(input: { cart_id: $id, email: $email }) { cart { id } }' : ''}
          a: setShippingAddressesOnCart(input: { cart_id: $id, shipping_addresses: [{ address: $addr }] }) { cart { id } }
          s: setShippingMethodsOnCart(input: { cart_id: $id, shipping_methods: [$m] }) { cart { id } }
          b: setBillingAddressOnCart(input: { cart_id: $id, billing_address: { same_as_shipping: true } }) { cart { id } }
          pay: setPaymentMethodOnCart(input: { cart_id: $id, payment_method: { code: "checkmo" } }) { cart { ${CART_FIELDS} } }
        }`,
        { id: cart.id, ...(guest ? { email: email.trim() } : {}), addr: toCartInput(ship), m: { carrier_code: m!.carrier_code, method_code: m!.method_code } },
      );
      setCart(d.pay.cart);
      setPay(d.pay.cart.selected_payment_method?.code ?? d.pay.cart.available_payment_methods[0]?.code ?? null);
      setBillSame(true);
      setStep('payment');
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    } catch (x) {
      setFail(x instanceof Error ? x.message : 'Something went wrong. Please try again.');
    }
    setBusy(false);
  };

  const placeOrder = async () => {
    if (!billSame) {
      const e = validateAddr(bill);
      setBillErr(e);
      if (Object.keys(e).length) return;
    }
    setBusy(true);
    setFail(null);
    try {
      const d = await gql<{ o: { orderV2: { number: string } | null; errors: { message: string }[] } }>(
        `mutation ($id: String!, $code: String!${billSame ? '' : ', $bill: CartAddressInput!'}) {
          ${billSame ? '' : 'b: setBillingAddressOnCart(input: { cart_id: $id, billing_address: { address: $bill } }) { cart { id } }'}
          p: setPaymentMethodOnCart(input: { cart_id: $id, payment_method: { code: $code } }) { cart { id } }
          o: placeOrder(input: { cart_id: $id }) { orderV2 { number } errors { message code } }
        }`,
        { id: cart.id, code: pay ?? 'checkmo', ...(billSame ? {} : { bill: toCartInput(bill) }) },
      );
      const num = d.o.orderV2?.number;
      if (!num) throw new Error(d.o.errors?.[0]?.message ?? 'The order could not be placed.');
      placed.current = true;
      try {
        sessionStorage.setItem('hl_last_order', JSON.stringify({ number: num, email: auth.loggedIn ? customer?.email : email.trim(), guest: !auth.loggedIn }));
      } catch {}
      clearCart();
      if (auth.loggedIn) void loadCart(true);
      router.replace('/checkout/onepage/success/');
    } catch (x) {
      setFail(x instanceof Error ? x.message : 'The order could not be placed. Please try again.');
      setBusy(false);
    }
  };

  const shipAddr = step === 'payment' ? fromCart(cart.shipping_addresses?.[0]) : ship;
  const payTitle = cart.available_payment_methods.find((p) => p.code === pay)?.title ?? 'Check / Money order';

  return (
    <div className="ts-co-page">
      <CoHeader />
      <div className="ts-container">
        <div className="ts-co">
          <div className="ts-co__top">
            <p className="ts-demo-note">
              <strong>Demo checkout.</strong> Use any address; pay with Check / Money order. Nothing is charged or shipped.
            </p>
            <ol className="ts-steps">
              <li className={step === 'shipping' ? 'is-on' : 'is-done'}>
                {step === 'payment' ? (
                  <button type="button" onClick={() => setStep('shipping')}>
                    <span className="ts-step__n">&#10003;</span>Shipping
                  </button>
                ) : (
                  <span className="ts-step" aria-current="step">
                    <span className="ts-step__n">1</span>Shipping
                  </span>
                )}
              </li>
              <li className={step === 'payment' ? 'is-on' : ''}>
                <span className="ts-step" aria-current={step === 'payment' ? 'step' : undefined}>
                  <span className="ts-step__n">2</span>Review &amp; Payments
                </span>
              </li>
            </ol>
            <button type="button" className="ts-co__mobsum" aria-expanded={mobSum} onClick={() => setMobSum(!mobSum)}>
              <span>
                Estimated total
                <strong>{money(cart.prices.grand_total.value)}</strong>
              </span>
              <span className="ts-co__mobsum-bag">
                <Icon name="bag" />
                <em>{cart.total_quantity}</em>
              </span>
            </button>
            {mobSum && (
              <div className="ts-co__mobsum-panel">
                <OrderSummary cart={cart} method={selected} />
              </div>
            )}
            {!auth.loggedIn && (
              <p className="ts-co__auth">
                Have an account? <Link href="/customer/account/login/?return=/checkout/">Sign in</Link>
              </p>
            )}
          </div>

          <div className="ts-co__main">
            {step === 'shipping' ? (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void goPayment();
                }}
              >
                <section className="ts-co__step" aria-labelledby="ts-co-ship-h">
                  <h2 id="ts-co-ship-h">Shipping address</h2>
                  <div className="ts-co__email">
                    {auth.loggedIn ? (
                      <p className="ts-co__signed">
                        Signed in as <strong>{customer?.email ?? auth.firstname}</strong>
                      </p>
                    ) : (
                      <div className="ts-field is-required">
                        <label htmlFor="co-email">Email address</label>
                        <input
                          id="co-email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          aria-invalid={!!err.email}
                          aria-describedby={err.email ? 'co-email-err' : undefined}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                        {err.email && (
                          <p className="ts-field-error" id="co-email-err">
                            {err.email}
                          </p>
                        )}
                        <p className="ts-note">You can create an account after checkout.</p>
                      </div>
                    )}
                  </div>
                  {customer && customer.addresses.length > 1 && (
                    <div className="ts-field">
                      <label htmlFor="ship-saved">Saved addresses</label>
                      <select
                        id="ship-saved"
                        defaultValue=""
                        onChange={(e) => {
                          const x = customer.addresses[Number(e.target.value)];
                          if (x) setShip(fromCart(x));
                        }}
                      >
                        <option value="">Choose a saved address</option>
                        {customer.addresses.map((x, i) => (
                          <option key={i} value={i}>
                            {x.firstname} {x.lastname}, {(x.street ?? []).join(' ')}, {x.city} {x.postcode}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <AddressFields id="ship" a={ship} set={setShip} err={err} regions={regions} />
                </section>
                <section className="ts-co__step" aria-labelledby="ts-co-method-h">
                  <h2 id="ts-co-method-h">Shipping method</h2>
                  {rates === null ? (
                    <p className="ts-co__muted">Loading shipping methods</p>
                  ) : rates.length === 0 ? (
                    <p className="ts-co__muted">Sorry, no quotes are available for this order right now.</p>
                  ) : (
                    <div className="ts-methods" role="radiogroup" aria-label="Shipping method">
                      {rates.map((m) => (
                        <label key={rateId(m)} className={`ts-method${rate === rateId(m) ? ' is-on' : ''}`}>
                          <input type="radio" name="co-rate" checked={rate === rateId(m)} onChange={() => setRate(rateId(m))} />
                          <span className="ts-method__price">{money(m.amount.value)}</span>
                          <span className="ts-method__name">{m.method_title}</span>
                          <span className="ts-method__carrier">{m.carrier_title}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {err.method && (
                    <p className="ts-co__method-err" role="alert" tabIndex={-1}>
                      {err.method}
                    </p>
                  )}
                  {fail && (
                    <p className="ts-co__fail" role="alert">
                      {fail}
                    </p>
                  )}
                  <div className="ts-co__next">
                    <button type="submit" className="ts-button" disabled={busy}>
                      {busy ? 'Saving' : 'Next'}
                    </button>
                  </div>
                </section>
              </form>
            ) : (
              <section className="ts-co__step ts-pay" aria-labelledby="ts-co-pay-h">
                <h2 id="ts-co-pay-h">Payment method</h2>
                {cart.available_payment_methods.length > 1 ? (
                  <div className="ts-methods" role="radiogroup" aria-label="Payment method">
                    {cart.available_payment_methods.map((p) => (
                      <label key={p.code} className={`ts-method${pay === p.code ? ' is-on' : ''}`}>
                        <input type="radio" name="co-pay" checked={pay === p.code} onChange={() => setPay(p.code)} />
                        <span className="ts-method__name">{p.title}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="ts-pay__title">{payTitle}</p>
                )}
                <label className="ts-billing-same">
                  <input
                    type="checkbox"
                    checked={billSame}
                    onChange={(e) => {
                      setBillSame(e.target.checked);
                      if (!e.target.checked && !bill.street1) setBill({ ...shipAddr });
                    }}
                  />
                  My billing and shipping address are the same
                </label>
                {billSame ? (
                  <div className="ts-pay__addr">
                    <AddressView a={shipAddr} regions={regions} />
                  </div>
                ) : (
                  <div className="ts-co__bill">
                    <AddressFields id="bill" a={bill} set={setBill} err={billErr} regions={regions} />
                  </div>
                )}
                {fail && (
                  <p className="ts-co__fail" role="alert">
                    {fail}
                  </p>
                )}
                <button type="button" className="ts-button ts-place" disabled={busy} onClick={placeOrder}>
                  {busy ? 'Placing order' : 'Place order'}
                </button>
                <DiscountBox cart={cart} />
              </section>
            )}
          </div>

          <aside className="ts-co__side" aria-label="Order summary">
            <OrderSummary cart={cart} method={selected} />
            {step === 'payment' && (
              <div className="ts-shipinfo">
                <div>
                  <h3>
                    Ship to
                    <button type="button" aria-label="Edit shipping address" onClick={() => setStep('shipping')}>
                      <Icon name="edit" />
                    </button>
                  </h3>
                  <AddressView a={shipAddr} regions={regions} />
                </div>
                {selected && (
                  <div>
                    <h3>
                      Shipping method
                      <button type="button" aria-label="Edit shipping method" onClick={() => setStep('shipping')}>
                        <Icon name="edit" />
                      </button>
                    </h3>
                    <p>
                      {selected.carrier_title} - {selected.method_title}
                    </p>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
      <CoFooter />
    </div>
  );
}

export function CoHeader() {
  return (
    <div className="ts-co-header">
      <div className="ts-container">
        <Link className="ts-logo" href="/" aria-label="Third Shot Supply Co. home">
          <img src="/logo.svg" alt="Third Shot Supply Co." width={291} height={76} />
        </Link>
        <span className="ts-co-header__secure">
          <Icon name="lock" />
          Secure checkout
        </span>
      </div>
    </div>
  );
}

export function CoFooter() {
  return (
    <div className="ts-co-footer">
      <span>&copy; 2026 Third Shot Supply Co. A fictional brand.</span>
      <span>Headless storefront: Next.js on Magento Open Source (Mage-OS) GraphQL.</span>
    </div>
  );
}
