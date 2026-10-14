import 'server-only';
import { magento, MagentoError } from '@/lib/magento/client';

const WEEK = 60 * 60 * 24 * 7;

export function sessionCookies(token: string, firstname: string): string[] {
  return [
    `hl_token=${token}; Path=/; Max-Age=${WEEK}; HttpOnly; Secure; SameSite=Lax`,
    `hl_auth=${encodeURIComponent(firstname || 'there')}; Path=/; Max-Age=${WEEK}; Secure; SameSite=Lax`,
  ];
}

export async function issueToken(email: string, password: string): Promise<{ token: string; firstname: string }> {
  const d = await magento<{ generateCustomerToken: { token: string } }>(
    `mutation ($e: String!, $p: String!) { generateCustomerToken(email: $e, password: $p) { token } }`,
    { e: email, p: password },
  );
  const token = d.generateCustomerToken.token;
  let firstname = '';
  try {
    const c = await magento<{ customer: { firstname: string } }>(`{ customer { firstname } }`, {}, { token });
    firstname = c.customer.firstname;
  } catch {}
  return { token, firstname };
}

/** Move a guest bag into the customer's cart after login/registration (best effort). */
export async function mergeGuestCart(token: string, guestCartId: unknown) {
  if (typeof guestCartId !== 'string' || !/^[A-Za-z0-9]{16,64}$/.test(guestCartId)) return;
  try {
    const c = await magento<{ customerCart: { id: string } }>(`{ customerCart { id } }`, {}, { token });
    if (c.customerCart.id !== guestCartId) {
      await magento(`mutation ($s: String!, $d: String!) { mergeCarts(source_cart_id: $s, destination_cart_id: $d) { id } }`, { s: guestCartId, d: c.customerCart.id }, { token });
    }
  } catch {}
}

export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof MagentoError && e.message) return e.message;
  return fallback;
}
