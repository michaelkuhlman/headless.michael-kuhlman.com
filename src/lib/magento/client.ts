import 'server-only';
import { Agent, fetch as undiciFetch } from 'undici';

/**
 * Server-side Magento GraphQL client.
 *
 * Magento runs on this same box, so requests to m2.michael-kuhlman.com are pinned to 127.0.0.1 (TLS + SNI stay
 * intact) instead of leaving through Cloudflare and coming back. Read queries go out as GET so Magento's own
 * full-page cache can answer them; mutations and customer/cart queries go as POST.
 */
export const MAGENTO_ORIGIN = process.env.MAGENTO_ORIGIN ?? 'https://m2.michael-kuhlman.com';
const MAGENTO_HOST = new URL(MAGENTO_ORIGIN).hostname;
const PIN_LOCAL = process.env.MAGENTO_PIN_LOCAL !== '0';

type LookupCb = (err: NodeJS.ErrnoException | null, address: string | { address: string; family: number }[], family?: number) => void;

const agent = new Agent({
  keepAliveTimeout: 30_000,
  connections: 16,
  connect: PIN_LOCAL
    ? {
        lookup(hostname: string, options: { all?: boolean }, cb: LookupCb) {
          if (hostname === MAGENTO_HOST) {
            if (options && options.all) cb(null, [{ address: '127.0.0.1', family: 4 }]);
            else cb(null, '127.0.0.1', 4);
            return;
          }
          // Anything else: normal DNS.
          import('node:dns').then((dns) => dns.lookup(hostname, options as never, cb as never));
        },
      }
    : undefined,
});

export class MagentoError extends Error {
  constructor(
    message: string,
    public readonly errors: { message: string; extensions?: { category?: string } }[] = [],
    public readonly status = 200,
  ) {
    super(message);
    this.name = 'MagentoError';
  }
}

export interface GqlOptions {
  /** Bearer token of a logged-in customer (never sent for catalogue reads). */
  token?: string | null;
  /** Force POST (mutations always use POST). */
  post?: boolean;
  /** Request timeout in ms. */
  timeoutMs?: number;
}

const isMutation = (q: string) => /^\s*mutation\b/.test(q);

/** Collapse whitespace so GET URLs stay short and identical between calls (better FPC hit rate). */
export function compact(query: string): string {
  return query.replace(/#[^\n]*/g, '').replace(/\s+/g, ' ').replace(/\s*([{}():,!=@$])\s*/g, '$1').trim();
}

export async function magento<T>(query: string, variables: Record<string, unknown> = {}, opts: GqlOptions = {}): Promise<T> {
  const q = compact(query);
  const usePost = opts.post || !!opts.token || isMutation(q);
  const headers: Record<string, string> = { Store: 'default', Accept: 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let url = `${MAGENTO_ORIGIN}/graphql`;
  let body: string | undefined;
  if (usePost) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ query: q, variables });
  } else {
    const params = new URLSearchParams({ query: q });
    if (Object.keys(variables).length) params.set('variables', JSON.stringify(variables));
    url += `?${params.toString()}`;
    if (url.length > 7000) {
      // Very long queries: fall back to POST rather than risk a 414.
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ query: q, variables });
      url = `${MAGENTO_ORIGIN}/graphql`;
    }
  }

  const res = await undiciFetch(url, {
    method: body ? 'POST' : 'GET',
    headers,
    body,
    dispatcher: agent,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
  });
  const text = await res.text();
  let json: { data?: T; errors?: { message: string; extensions?: { category?: string } }[] };
  try {
    json = JSON.parse(text);
  } catch {
    throw new MagentoError(`Magento returned non-JSON (${res.status})`, [], res.status);
  }
  if (json.errors?.length) {
    // Partial data with errors (e.g. one bad field) still returns data; callers decide via `strict`.
    throw new MagentoError(json.errors.map((e) => e.message).join('; '), json.errors, res.status);
  }
  if (!json.data) throw new MagentoError(`Magento returned no data (${res.status})`, [], res.status);
  return json.data;
}

/** Proxy a raw GraphQL request (browser -> /api/gql -> Magento). Returns status + body untouched. */
export async function magentoRaw(body: string, token?: string | null): Promise<{ status: number; body: string }> {
  const headers: Record<string, string> = { Store: 'default', 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await undiciFetch(`${MAGENTO_ORIGIN}/graphql`, {
    method: 'POST',
    headers,
    body,
    dispatcher: agent,
    signal: AbortSignal.timeout(25_000),
  });
  return { status: res.status, body: await res.text() };
}
