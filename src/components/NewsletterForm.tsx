'use client';

import { useState } from 'react';
import { gql } from '@/lib/client/gql';

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const d = await gql<{ subscribeEmailToNewsletter: { status: string } }>(
        `mutation ($e: String!) { subscribeEmailToNewsletter(email: $e) { status } }`,
        { e: email.trim() },
      );
      const s = d.subscribeEmailToNewsletter.status;
      setMsg({ ok: true, text: s === 'NOT_ACTIVE' ? 'Check your inbox to confirm (demo: no email is sent).' : 'Thanks, you are on the list.' });
      setEmail('');
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'That did not work. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ts-newsletter">
      <form onSubmit={submit} noValidate={false}>
        <label htmlFor="ts-news-email" className="sr-only">Email address</label>
        <input id="ts-news-email" type="email" required placeholder="Enter your email address" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" disabled={busy}>{busy ? 'Sending' : 'Subscribe'}</button>
      </form>
      <p className={`ts-newsletter__msg${msg && !msg.ok ? ' is-error' : ''}`} role="status" aria-live="polite" hidden={!msg}>
        {msg?.text}
      </p>
    </div>
  );
}
