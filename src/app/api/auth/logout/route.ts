import { cookies } from 'next/headers';
import { magento } from '@/lib/magento/client';

export async function POST() {
  const token = (await cookies()).get('hl_token')?.value;
  if (token) {
    try {
      await magento(`mutation { revokeCustomerToken { result } }`, {}, { token });
    } catch {}
  }
  const res = Response.json({ ok: true });
  res.headers.append('Set-Cookie', 'hl_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
  res.headers.append('Set-Cookie', 'hl_auth=; Path=/; Max-Age=0; Secure; SameSite=Lax');
  return res;
}
