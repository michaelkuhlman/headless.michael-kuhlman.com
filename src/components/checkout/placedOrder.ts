import type { Cart } from '@/lib/client/cart';

/**
 * The order just placed, as the success page shows it (items, totals, ship-to). Built from the cart right before
 * placeOrder, which itself asks only for the order number: with more fields, any resolver error would make gql()
 * throw after the order exists, show "failed" and invite a second order. Kept in sessionStorage next to the order
 * number, like Luma's checkout session.
 */

export interface OrderSummaryData {
  items: { name: string; qty: number; total: number; options: [string, string][] }[];
  subtotal: number;
  shipping: number;
  shippingLabel: string | null;
  tax: number;
  discount: number;
  grandTotal: number;
  shipTo: string[] | null;
}

export function summarizeCart(cart: Cart): OrderSummaryData {
  const ship = cart.shipping_addresses?.[0] ?? null;
  const method = ship?.selected_shipping_method ?? null;
  return {
    items: cart.items.map((it) => ({
      name: it.product.name,
      qty: it.quantity,
      total: it.prices?.row_total?.value ?? 0,
      options: [
        ...(it.configurable_options ?? []).map((o) => [o.option_label, o.value_label] as [string, string]),
        ...(it.bundle_options ?? []).map((b) => [b.label, b.values.map((v) => `${v.quantity} x ${v.label}`).join(', ')] as [string, string]),
      ],
    })),
    subtotal: cart.prices.subtotal_excluding_tax.value,
    shipping: method?.amount.value ?? 0,
    shippingLabel: method ? `${method.carrier_title} - ${method.method_title}` : null,
    tax: (cart.prices.applied_taxes ?? []).reduce((n, t) => n + t.amount.value, 0),
    discount: (cart.prices.discounts ?? []).reduce((n, d) => n + d.amount.value, 0),
    grandTotal: cart.prices.grand_total.value,
    shipTo: ship
      ? [
          `${ship.firstname} ${ship.lastname}`,
          ...ship.street,
          [ship.city, [ship.region?.label, ship.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', '),
          countryName(ship.country?.code, ship.country?.label),
        ].filter(Boolean)
      : null,
  };
}

/** The cart's country label is the bare code ("US"): spell it out. */
function countryName(code?: string, label?: string): string {
  if (label && label !== code) return label;
  try {
    return (code && new Intl.DisplayNames(['en'], { type: 'region' }).of(code)) || code || '';
  } catch {
    return code ?? '';
  }
}
