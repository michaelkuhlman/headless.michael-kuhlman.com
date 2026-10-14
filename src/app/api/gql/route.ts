import { crossOrigin } from '@/lib/server/sameOrigin';
import { cookies } from 'next/headers';
import { magentoRaw } from '@/lib/magento/client';

/** Browser GraphQL proxy: same-origin (no CORS), adds the customer's bearer token from the httpOnly cookie. */
export async function POST(req: Request) {
  const bad = crossOrigin(req);
  if (bad) return bad;
  const body = await req.text();
  if (body.length > 64_000) return Response.json({ errors: [{ message: 'Request too large' }] }, { status: 413 });
  const token = (await cookies()).get('hl_token')?.value ?? null;
  try {
    const r = await magentoRaw(body, token);
    const res = new Response(r.body, { status: r.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    // An expired/revoked token: drop both cookies so the UI falls back to guest mode.
    if (token && /graphql-authorization|isn't authorized|not authorized/i.test(r.body)) {
      res.headers.append('Set-Cookie', 'hl_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
      res.headers.append('Set-Cookie', 'hl_auth=; Path=/; Max-Age=0; Secure; SameSite=Lax');
    }
    return res;
  } catch {
    return Response.json({ errors: [{ message: 'The store is not answering right now. Please try again.' }] }, { status: 502 });
  }
}
