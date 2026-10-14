'use client';

import { useSyncExternalStore } from 'react';
import { gql, GqlError } from './gql';
import { getAuth, subscribeAuth } from './auth';

/*
 * Cart store (one per tab). The cart lives in Magento; we keep its masked id in localStorage for guests and use
 * customerCart for logged-in shoppers. Components subscribe with useCart().
 */

export const CART_FIELDS = `
  id email total_quantity is_virtual
  items {
    uid quantity __typename
    product { uid sku name url_key __typename stock_status small_image { url label }
      price_range { minimum_price { regular_price { value } final_price { value } } } }
    prices { price { value } row_total { value } total_item_discount { value } }
    ... on ConfigurableCartItem { configurable_options { configurable_product_option_value_uid option_label value_label } configured_variant { sku small_image { url label } } }
    ... on BundleCartItem { bundle_options { label values { label quantity } } }
  }
  prices {
    subtotal_excluding_tax { value } subtotal_including_tax { value } grand_total { value }
    applied_taxes { label amount { value } }
    discounts { label amount { value } }
  }
  applied_coupons { code }
  shipping_addresses {
    firstname lastname company street city postcode telephone
    region { code label region_id } country { code label }
    available_shipping_methods { carrier_code method_code carrier_title method_title amount { value } available error_message }
    selected_shipping_method { carrier_code method_code carrier_title method_title amount { value } }
  }
  billing_address { firstname lastname company street city postcode telephone region { code label region_id } country { code label } }
  available_payment_methods { code title }
  selected_payment_method { code title }
`;

export interface CartItem {
  uid: string;
  quantity: number;
  __typename: string;
  product: {
    uid: string;
    sku: string;
    name: string;
    url_key: string;
    __typename: string;
    stock_status: string;
    small_image: { url: string; label: string | null } | null;
    price_range: { minimum_price: { regular_price: { value: number }; final_price: { value: number } } };
  };
  prices: { price: { value: number }; row_total: { value: number }; total_item_discount: { value: number } | null };
  configurable_options?: { configurable_product_option_value_uid?: string; option_label: string; value_label: string }[];
  configured_variant?: { sku: string; small_image: { url: string; label: string | null } | null };
  bundle_options?: { label: string; values: { label: string; quantity: number }[] }[];
}

export interface ShippingMethod {
  carrier_code: string;
  method_code: string;
  carrier_title: string;
  method_title: string;
  amount: { value: number };
  available?: boolean;
  error_message?: string | null;
}

export interface CartAddress {
  firstname: string;
  lastname: string;
  company: string | null;
  street: string[];
  city: string;
  postcode: string | null;
  telephone: string | null;
  region: { code: string | null; label: string | null; region_id: number | null } | null;
  country: { code: string; label: string };
}

export interface Cart {
  id: string;
  email: string | null;
  total_quantity: number;
  is_virtual: boolean;
  items: CartItem[];
  prices: {
    subtotal_excluding_tax: { value: number };
    subtotal_including_tax: { value: number };
    grand_total: { value: number };
    applied_taxes: { label: string; amount: { value: number } }[];
    discounts: { label: string; amount: { value: number } }[] | null;
  };
  applied_coupons: { code: string }[] | null;
  shipping_addresses: (CartAddress & {
    available_shipping_methods: ShippingMethod[];
    selected_shipping_method: ShippingMethod | null;
  })[];
  billing_address: CartAddress | null;
  available_payment_methods: { code: string; title: string }[];
  selected_payment_method: { code: string; title: string } | null;
}

export interface AddedInfo {
  name: string;
  image: string | null;
  qty: number;
  options?: string;
  crosssell?: string[]; // url_keys
  url_key: string;
}

interface State {
  cart: Cart | null;
  ready: boolean;
  busy: boolean;
  drawer: 'closed' | 'added' | 'bag';
  added: AddedInfo | null;
  error: string | null;
  bump: number;
}

const KEY = 'hl_cart';
let state: State = { cart: null, ready: false, busy: false, drawer: 'closed', added: null, error: null, bump: 0 };
const listeners = new Set<() => void>();
const SERVER: State = state;

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useCart(): State {
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}
export const getCartState = () => state;

const guestId = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const setGuestId = (id: string | null) => {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
};

let loading: Promise<void> | null = null;
// Bumped by every new load and by clearCart: a response from an older load (e.g. the customer cart that
// was requested just before sign-out) is dropped instead of overwriting newer state.
let gen = 0;

/** Load the current cart (no cart is created until something is added). */
export function loadCart(force = false): Promise<void> {
  if (loading && !force) return loading;
  const g = ++gen;
  const apply = (patch: Partial<State>) => {
    if (g === gen) set(patch);
  };
  let p: Promise<void> | undefined = undefined;
  p = (async () => {
    await null; // keep the finally below after `loading = p`, even on the synchronous paths
    try {
      if (getAuth().loggedIn) {
        const d = await gql<{ customerCart: Cart }>(`{ customerCart { ${CART_FIELDS} } }`);
        if (getAuth().loggedIn) apply({ cart: d.customerCart, ready: true });
        return;
      }
      const id = guestId();
      if (!id) {
        apply({ cart: null, ready: true });
        return;
      }
      const d = await gql<{ cart: Cart }>(`query ($id: String!) { cart(cart_id: $id) { ${CART_FIELDS} } }`, { id });
      apply({ cart: d.cart, ready: true });
    } catch (e) {
      if (g !== gen) return;
      // Expired / ordered / foreign cart: start fresh.
      if (e instanceof GqlError && /cart|authoriz|active/i.test(e.message)) setGuestId(null);
      set({ cart: null, ready: true });
    } finally {
      if (loading === p) loading = null;
    }
  })();
  loading = p;
  return p;
}

async function ensureCartId(): Promise<string> {
  if (state.cart?.id) return state.cart.id;
  if (getAuth().loggedIn) {
    const d = await gql<{ customerCart: { id: string } }>(`{ customerCart { id } }`);
    return d.customerCart.id;
  }
  const existing = guestId();
  if (existing) return existing;
  const d = await gql<{ createGuestCart: { cart: { id: string } } }>(`mutation { createGuestCart { cart { id } } }`);
  setGuestId(d.createGuestCart.cart.id);
  return d.createGuestCart.cart.id;
}

export interface AddLine {
  sku: string;
  quantity: number;
  parent_sku?: string;
  selected_options?: string[];
  entered_options?: { uid: string; value: string }[];
}

export async function addToCart(lines: AddLine[], info?: AddedInfo, openDrawer = true): Promise<boolean> {
  set({ busy: true, error: null });
  try {
    let id = await ensureCartId();
    const run = (cid: string) =>
      gql<{ addProductsToCart: { cart: Cart; user_errors: { code: string; message: string }[] } }>(
        `mutation ($id: String!, $items: [CartItemInput!]!) { addProductsToCart(cartId: $id, cartItems: $items) { cart { ${CART_FIELDS} } user_errors { code message } } }`,
        { id: cid, items: lines },
      );
    let d;
    try {
      d = await run(id);
    } catch (e) {
      // A stale guest cart (ordered elsewhere): make a new one and retry once.
      if (!getAuth().loggedIn && e instanceof GqlError && /cart/i.test(e.message)) {
        setGuestId(null);
        set({ cart: null });
        id = await ensureCartId();
        d = await run(id);
      } else throw e;
    }
    const errs = d.addProductsToCart.user_errors;
    set({ cart: d.addProductsToCart.cart, ready: true });
    if (errs.length) {
      set({ error: errs[0].message, busy: false });
      return false;
    }
    set({ busy: false, bump: state.bump + 1, ...(openDrawer && info ? { drawer: 'added', added: info } : {}) });
    return true;
  } catch (e) {
    set({ busy: false, error: e instanceof Error ? e.message : 'Could not add to bag.' });
    return false;
  }
}

export async function updateQty(uid: string, quantity: number) {
  if (!state.cart) return;
  set({ busy: true, error: null });
  try {
    const d = await gql<{ updateCartItems: { cart: Cart } }>(
      `mutation ($id: String!, $items: [CartItemUpdateInput!]!) { updateCartItems(input: { cart_id: $id, cart_items: $items }) { cart { ${CART_FIELDS} } } }`,
      { id: state.cart.id, items: [{ cart_item_uid: uid, quantity }] },
    );
    set({ cart: d.updateCartItems.cart, busy: false });
  } catch (e) {
    set({ busy: false, error: e instanceof Error ? e.message : 'Could not update the bag.' });
  }
}

export async function removeItem(uid: string) {
  if (!state.cart) return;
  set({ busy: true, error: null });
  try {
    const d = await gql<{ removeItemFromCart: { cart: Cart } }>(
      `mutation ($id: String!, $uid: ID!) { removeItemFromCart(input: { cart_id: $id, cart_item_uid: $uid }) { cart { ${CART_FIELDS} } } }`,
      { id: state.cart.id, uid },
    );
    set({ cart: d.removeItemFromCart.cart, busy: false });
  } catch (e) {
    set({ busy: false, error: e instanceof Error ? e.message : 'Could not remove the item.' });
  }
}

export async function applyCoupon(code: string): Promise<string | null> {
  if (!state.cart) return 'Your bag is empty.';
  try {
    const d = await gql<{ applyCouponToCart: { cart: Cart } }>(
      `mutation ($id: String!, $c: String!) { applyCouponToCart(input: { cart_id: $id, coupon_code: $c }) { cart { ${CART_FIELDS} } } }`,
      { id: state.cart.id, c: code },
    );
    set({ cart: d.applyCouponToCart.cart });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'That code did not work.';
  }
}

export async function removeCoupon(): Promise<void> {
  if (!state.cart) return;
  const d = await gql<{ removeCouponFromCart: { cart: Cart } }>(
    `mutation ($id: String!) { removeCouponFromCart(input: { cart_id: $id }) { cart { ${CART_FIELDS} } } }`,
    { id: state.cart.id },
  );
  set({ cart: d.removeCouponFromCart.cart });
}

/** Replace the cart object after a checkout mutation. */
export function setCart(cart: Cart | null) {
  set({ cart });
}

/** After an order is placed the cart is gone. */
export function clearCart() {
  gen++;
  setGuestId(null);
  set({ cart: null });
}

export function openBag() {
  set({ drawer: 'bag' });
}
export function closeDrawer() {
  set({ drawer: 'closed' });
}
export function clearError() {
  set({ error: null });
}

if (typeof window !== 'undefined') {
  subscribeAuth(() => {
    void loadCart(true);
  });
}
