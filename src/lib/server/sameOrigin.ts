/**
 * Reject state-changing API calls that do not come from this site's own pages.
 * Browsers send Sec-Fetch-Site on every fetch; older ones fall back to the Origin header.
 * SameSite=Lax cookies already stop cross-site posts; this also stops sibling subdomains.
 */
export function crossOrigin(req: Request): Response | null {
  const site = req.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin' ? null : deny();
  const origin = req.headers.get('origin');
  if (!origin) return null; // non-browser client: no ambient cookies to abuse
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  try {
    return new URL(origin).host === host ? null : deny();
  } catch {
    return deny();
  }
}

const deny = () => Response.json({ ok: false, errors: [{ message: 'Forbidden' }] }, { status: 403 });
