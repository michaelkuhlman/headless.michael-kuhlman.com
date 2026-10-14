'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AccountShell, fmtDate, useCustomer } from './AccountShell';
import { money } from '@/lib/format';

/** Dashboard, order history and order detail for a signed-in customer (Magento customer GraphQL). */

interface Addr {
  firstname: string;
  lastname: string;
  company?: string | null;
  street: string[];
  city: string;
  region?: string | null;
  postcode: string;
  telephone?: string | null;
  country_code?: string;
}

interface OrderRow {
  number: string;
  order_date: string;
  status: string;
  total: { grand_total: { value: number } };
  shipping_address: { firstname: string; lastname: string } | null;
}

const ROW = `number order_date status total { grand_total { value } } shipping_address { firstname lastname }`;
const ADDR = `firstname lastname company street city region postcode telephone country_code`;

export function AddrBlock({ a }: { a: Addr | null | undefined }) {
  if (!a) return <p className="ts-muted">You have not set a default address.</p>;
  return (
    <address>
      {a.firstname} {a.lastname}
      <br />
      {a.company && (
        <>
          {a.company}
          <br />
        </>
      )}
      {a.street.join(', ')}
      <br />
      {a.city}, {a.region} {a.postcode}
      <br />
      United States
      {a.telephone && (
        <>
          <br />
          T: {a.telephone}
        </>
      )}
    </address>
  );
}

function OrdersTable({ rows }: { rows: OrderRow[] }) {
  if (!rows.length) return <p className="ts-acct__empty">You have placed no orders.</p>;
  return (
    <table className="ts-orders">
      <thead>
        <tr>
          <th scope="col">Order #</th>
          <th scope="col">Date</th>
          <th scope="col">Ship To</th>
          <th scope="col">Order Total</th>
          <th scope="col">Status</th>
          <th scope="col">
            <span className="sr-only">Action</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((o) => (
          <tr key={o.number}>
            <td data-th="Order #">
              <strong>{o.number}</strong>
            </td>
            <td data-th="Date">{fmtDate(o.order_date)}</td>
            <td data-th="Ship To">{o.shipping_address ? `${o.shipping_address.firstname} ${o.shipping_address.lastname}` : ''}</td>
            <td data-th="Order Total">{money(o.total.grand_total.value)}</td>
            <td data-th="Status">
              <span className="ts-pill">{o.status}</span>
            </td>
            <td>
              <Link className="ts-textlink" href={`/sales/order/view/?number=${encodeURIComponent(o.number)}`}>
                View Order
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface Dash {
  customer: {
    firstname: string;
    lastname: string;
    email: string;
    is_subscribed: boolean;
    addresses: (Addr & { default_billing: boolean; default_shipping: boolean; region: { region: string } | null })[];
    orders: { items: OrderRow[] };
  };
}

export function Dashboard() {
  const welcome = useSearchParams().get('welcome') === '1';
  const { data, error } = useCustomer<Dash>(
    `{ customer { firstname lastname email is_subscribed addresses { firstname lastname company street city region { region } postcode telephone default_billing default_shipping }
      orders(pageSize: 5, sort: { sort_field: CREATED_AT, sort_direction: DESC }) { items { ${ROW} } } } }`,
  );
  const c = data?.customer;
  const norm = (a?: Dash['customer']['addresses'][number]) => (a ? { ...a, region: a.region?.region ?? '' } : null);
  return (
    <AccountShell title="My Account">
      {welcome && (
        <p className="ts-alert ts-alert--ok" role="status">
          Thank you for registering with Third Shot Supply Co.
        </p>
      )}
      {error && <p className="ts-alert">{error}</p>}
      {!c ? (
        <div className="ts-acct__skeleton" aria-busy="true" />
      ) : (
        <>
          <h2>Account Information</h2>
          <div className="ts-acct__grid">
            <div className="ts-card-box">
              <h3>Contact Information</h3>
              <p>
                {c.firstname} {c.lastname}
                <br />
                {c.email}
              </p>
              <p className="ts-acct__links">
                <Link className="ts-textlink" href="/customer/account/edit/">
                  Edit
                </Link>
                <Link className="ts-textlink" href="/customer/account/edit/?changepass=1">
                  Change Password
                </Link>
              </p>
            </div>
            <div className="ts-card-box">
              <h3>Newsletters</h3>
              <p>{c.is_subscribed ? 'You are subscribed to "General Subscription".' : "You aren't subscribed to our newsletter."}</p>
              <p className="ts-acct__links">
                <Link className="ts-textlink" href="/newsletter/manage/">
                  Edit
                </Link>
              </p>
            </div>
          </div>
          <h2>
            Address Book{' '}
            <Link className="ts-textlink ts-acct__h-link" href="/customer/address/">
              Manage Addresses
            </Link>
          </h2>
          <div className="ts-acct__grid">
            <div className="ts-card-box">
              <h3>Default Billing Address</h3>
              <AddrBlock a={norm(c.addresses.find((a) => a.default_billing))} />
            </div>
            <div className="ts-card-box">
              <h3>Default Shipping Address</h3>
              <AddrBlock a={norm(c.addresses.find((a) => a.default_shipping))} />
            </div>
          </div>
          <h2>
            Recent Orders{' '}
            {c.orders.items.length > 0 && (
              <Link className="ts-textlink ts-acct__h-link" href="/sales/order/history/">
                View All
              </Link>
            )}
          </h2>
          <OrdersTable rows={c.orders.items} />
        </>
      )}
    </AccountShell>
  );
}

export function OrderHistory() {
  const { data, error } = useCustomer<{ customer: { orders: { items: OrderRow[] } } }>(
    `{ customer { orders(pageSize: 50, sort: { sort_field: CREATED_AT, sort_direction: DESC }) { items { ${ROW} } } } }`,
  );
  return (
    <AccountShell title="My Orders">
      {error && <p className="ts-alert">{error}</p>}
      {data ? <OrdersTable rows={data.customer.orders.items} /> : <div className="ts-acct__skeleton" aria-busy="true" />}
    </AccountShell>
  );
}

export interface OrderFull extends OrderRow {
  shipping_method: string | null;
  payment_methods: { name: string }[];
  shipping_address: Addr | null;
  billing_address: Addr | null;
  items: { product_name: string; product_sku: string; product_url_key: string | null; quantity_ordered: number; product_sale_price: { value: number }; selected_options: { label: string; value: string }[]; bundle_options?: { label: string; values: { product_name: string; quantity: number }[] }[] }[];
  total: {
    subtotal: { value: number };
    total_shipping: { value: number };
    total_tax: { value: number };
    discounts: { label: string; amount: { value: number } }[];
    grand_total: { value: number };
  };
}

export const ORDER_FIELDS = `number order_date status shipping_method payment_methods { name }
  shipping_address { ${ADDR} } billing_address { ${ADDR} }
  items { product_name product_sku product_url_key quantity_ordered product_sale_price { value } selected_options { label value } ... on BundleOrderItem { bundle_options { label values { product_name quantity } } } }
  total { subtotal { value } total_shipping { value } total_tax { value } discounts { label amount { value } } grand_total { value } }`;

export function OrderDetail({ o, guest = false }: { o: OrderFull; guest?: boolean }) {
  return (
    <div className="ts-order">
      <p className="ts-order__meta">
        <span className="ts-pill">{o.status}</span> <span>{fmtDate(o.order_date)}</span>
      </p>
      <h2>Items Ordered</h2>
      <table className="ts-orders ts-order__items">
        <thead>
          <tr>
            <th scope="col">Product Name</th>
            <th scope="col">SKU</th>
            <th scope="col">Price</th>
            <th scope="col">Qty</th>
            <th scope="col">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {o.items.map((it, i) => (
            <tr key={i}>
              <td>
                {it.product_url_key ? <Link href={`/${it.product_url_key}.html`}>{it.product_name}</Link> : it.product_name}
                {it.selected_options.map((s) => (
                  <small key={s.label} className="ts-order__opt">
                    {s.label}: {s.value}
                  </small>
                ))}
                {it.bundle_options?.map((b) => (
                  <small key={b.label} className="ts-order__opt">
                    {b.label}: {b.values.map((v) => `${v.quantity > 1 ? `${v.quantity} x ` : ''}${v.product_name}`).join(', ')}
                  </small>
                ))}
              </td>
              <td data-th="SKU">{it.product_sku}</td>
              <td data-th="Price">{money(it.product_sale_price.value)}</td>
              <td data-th="Qty">{it.quantity_ordered}</td>
              <td data-th="Subtotal">{money(it.product_sale_price.value * it.quantity_ordered)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="ts-totals ts-order__totals">
        <tbody>
          <tr>
            <th scope="row">Subtotal</th>
            <td>{money(o.total.subtotal.value)}</td>
          </tr>
          {o.total.discounts.map((d, i) => (
            <tr key={i} className="is-disc">
              <th scope="row">{d.label}</th>
              <td>-{money(d.amount.value)}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">Shipping &amp; Handling</th>
            <td>{money(o.total.total_shipping.value)}</td>
          </tr>
          {o.total.total_tax.value > 0 && (
            <tr>
              <th scope="row">Tax</th>
              <td>{money(o.total.total_tax.value)}</td>
            </tr>
          )}
          <tr className="is-grand">
            <th scope="row">Grand Total</th>
            <td>{money(o.total.grand_total.value)}</td>
          </tr>
        </tbody>
      </table>
      <h2>Order Information</h2>
      <div className="ts-acct__grid ts-acct__grid--4">
        <div className="ts-card-box">
          <h3>Shipping Address</h3>
          <AddrBlock a={o.shipping_address} />
        </div>
        <div className="ts-card-box">
          <h3>Shipping Method</h3>
          <p>{o.shipping_method}</p>
        </div>
        <div className="ts-card-box">
          <h3>Billing Address</h3>
          <AddrBlock a={o.billing_address} />
        </div>
        <div className="ts-card-box">
          <h3>Payment Method</h3>
          <p>{o.payment_methods.map((p) => p.name).join(', ')}</p>
        </div>
      </div>
      {!guest && (
        <Link className="ts-textlink ts-back" href="/sales/order/history/">
          Back to My Orders
        </Link>
      )}
    </div>
  );
}

export function OrderView() {
  const raw = useSearchParams().get('number') ?? '';
  const num = /^[\w-]{1,32}$/.test(raw) ? raw : '';
  const { data, error } = useCustomer<{ customer: { orders: { items: OrderFull[] } } }>(
    `{ customer { orders(filter: { number: { eq: ${JSON.stringify(num)} } }) { items { ${ORDER_FIELDS} } } } }`,
    [num],
  );
  const o = data?.customer.orders.items[0];
  return (
    <AccountShell title={o ? `Order # ${o.number}` : 'Order'}>
      {error && <p className="ts-alert">{error}</p>}
      {data && !o && <p className="ts-alert">We could not find that order on your account.</p>}
      {!data && !error && <div className="ts-acct__skeleton" aria-busy="true" />}
      {o && <OrderDetail o={o} />}
    </AccountShell>
  );
}
