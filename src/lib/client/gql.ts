'use client';

/** Browser -> /api/gql -> Magento. The customer token (if any) is added server-side from an httpOnly cookie. */
export class GqlError extends Error {
  constructor(
    message: string,
    public readonly category?: string,
  ) {
    super(message);
    this.name = 'GqlError';
  }
}

export async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch('/api/gql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    credentials: 'same-origin',
  });
  let json: { data?: T; errors?: { message: string; extensions?: { category?: string } }[] };
  try {
    json = await res.json();
  } catch {
    throw new GqlError(`The store did not answer (${res.status}). Please try again.`);
  }
  if (json.errors?.length) {
    const e = json.errors[0];
    throw new GqlError(cleanMessage(e.message), e.extensions?.category);
  }
  if (!json.data) throw new GqlError('The store did not answer. Please try again.');
  return json.data;
}

function cleanMessage(m: string): string {
  // Magento sometimes prefixes field paths; keep the human part.
  return m.replace(/^Field\s+"[^"]+"\s+/, '').replace(/\s+/g, ' ').trim();
}

export { money } from '../format';
