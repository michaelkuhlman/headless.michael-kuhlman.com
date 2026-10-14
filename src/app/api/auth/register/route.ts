import { magento } from '@/lib/magento/client';
import { errorMessage, issueToken, mergeGuestCart, sessionCookies } from '../session';

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as {
    firstname?: string; lastname?: string; email?: string; password?: string; newsletter?: boolean; guestCartId?: string;
  };
  if (!b.firstname || !b.lastname || !b.email || !b.password) {
    return Response.json({ ok: false, message: 'Please fill in every field.' }, { status: 400 });
  }
  try {
    await magento(
      `mutation ($i: CustomerCreateInput!) { createCustomerV2(input: $i) { customer { email } } }`,
      { i: { firstname: b.firstname.trim(), lastname: b.lastname.trim(), email: b.email.trim(), password: b.password, is_subscribed: !!b.newsletter } },
    );
    const { token, firstname } = await issueToken(b.email.trim(), b.password);
    await mergeGuestCart(token, b.guestCartId);
    const res = Response.json({ ok: true, firstname });
    for (const c of sessionCookies(token, firstname)) res.headers.append('Set-Cookie', c);
    return res;
  } catch (e) {
    return Response.json({ ok: false, message: errorMessage(e, 'We could not create the account. Please try again.') }, { status: 400 });
  }
}
