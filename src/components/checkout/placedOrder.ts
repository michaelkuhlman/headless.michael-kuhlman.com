/**
 * The order just placed, as the success page shows it (items, totals, ship-to). placeOrder returns it (orderV2), the
 * checkout keeps this summary in sessionStorage next to the order number, like Luma's checkout session.
 */

export const PLACED_ORDER_FIELDS = `
  items {
    product_name quantity_ordered
    prices { row_total { value } }
    selected_options { label value }
    ... on BundleOrderItem { bundle_options { label values { product_name quantity } } }
  }
  total { subtotal_excl_tax { value } total_shipping { value } total_tax { value } grand_total { value } discounts { amount { value } } }
  shipping_address { firstname lastname street city region postcode country_code }
  shipping_method
`;

type Money = { value: number };

export interface PlacedOrder {
  items: {
    product_name: string;
    quantity_ordered: number;
    prices: { row_total: Money } | null;
    selected_options: { label: string; value: string }[] | null;
    bundle_options?: { label: string; values: { product_name: string; quantity: number }[] }[] | null;
  }[];
  total: { subtotal_excl_tax: Money; total_shipping: Money; total_tax: Money; grand_total: Money; discounts: { amount: Money }[] | null } | null;
  shipping_address: { firstname: string; lastname: string; street: string[]; city: string; region: string | null; postcode: string | null; country_code: string | null } | null;
  shipping_method: string | null;
}

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

export function summarize(o: PlacedOrder): OrderSummaryData {
  const a = o.shipping_address;
  return {
    items: o.items.map((it) => ({
      name: it.product_name,
      qty: Number(it.quantity_ordered) || 1,
      total: it.prices?.row_total?.value ?? 0,
      options: [
        ...(it.selected_options ?? []).map((x) => [x.label, x.value] as [string, string]),
        ...(it.bundle_options ?? []).map((b) => [b.label, b.values.map((v) => `${v.quantity} x ${v.product_name}`).join(', ')] as [string, string]),
      ],
    })),
    subtotal: o.total?.subtotal_excl_tax.value ?? 0,
    shipping: o.total?.total_shipping.value ?? 0,
    shippingLabel: o.shipping_method,
    tax: o.total?.total_tax.value ?? 0,
    discount: (o.total?.discounts ?? []).reduce((n, x) => n + (x.amount?.value ?? 0), 0),
    grandTotal: o.total?.grand_total.value ?? 0,
    shipTo: a
      ? [`${a.firstname} ${a.lastname}`, ...a.street, [a.city, [a.region, a.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', '), a.country_code === 'US' ? 'United States' : (a.country_code ?? '')].filter(Boolean)
      : null,
  };
}
