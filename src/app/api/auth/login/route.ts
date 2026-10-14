import { crossOrigin } from '@/lib/server/sameOrigin';
import { errorMessage, issueToken, mergeGuestCart, sessionCookies } from '../session';

export async function POST(req: Request) {
  const bad = crossOrigin(req);
  if (bad) return bad;
  const b = (await req.json().catch(() => ({}))) as { email?: string; password?: string; guestCartId?: string };
  if (!b.email || !b.password) return Response.json({ ok: false, message: 'Enter your email and password.' }, { status: 400 });
  try {
    const { token, firstname } = await issueToken(b.email.trim(), b.password);
    await mergeGuestCart(token, b.guestCartId);
    const res = Response.json({ ok: true, firstname });
    for (const c of sessionCookies(token, firstname)) res.headers.append('Set-Cookie', c);
    return res;
  } catch (e) {
    return Response.json({ ok: false, message: errorMessage(e, 'Sign-in failed. Please try again.') }, { status: 401 });
  }
}
