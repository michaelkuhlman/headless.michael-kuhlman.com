'use client';

import { useState } from 'react';
import { gql } from '@/lib/client/gql';

export interface RatingMeta {
  id: string;
  name: string;
  values: { value_id: string; value: string }[];
}

export function ReviewForm({ sku, name, ratings }: { sku: string; name: string; ratings: RatingMeta[] }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ nickname: '', summary: '', text: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const miss = ratings.find((r) => !vals[r.id]);
    if (miss) {
      setMsg({ ok: false, text: `Please pick a star rating for ${miss.name.toLowerCase()}.` });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await gql(
        `mutation ($i: CreateProductReviewInput!) { createProductReview(input: $i) { review { nickname } } }`,
        { i: { sku, ...form, ratings: ratings.map((r) => ({ id: r.id, value_id: vals[r.id] })) } },
      );
      setMsg({ ok: true, text: 'Thanks! Your review was submitted and will show once it is approved.' });
      setForm({ nickname: '', summary: '', text: '' });
      setVals({});
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not submit the review.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="ts-review-form" id="review-form" onSubmit={submit} style={{ scrollMarginTop: 90 }}>
      <h3>Write your own review</h3>
      <p className="ts-sub">
        You&rsquo;re reviewing:
        <strong>{name}</strong>
      </p>
      {ratings.map((r) => (
        <div key={r.id}>
          <span className="ts-label">
            Your rating <span style={{ color: 'var(--ts-clay)' }}>*</span>
          </span>
          <fieldset className="ts-vote" aria-label={`${r.name} rating`}>
            {[...r.values].reverse().map((v) => {
              const id = `rv-${r.id}-${v.value}`;
              return (
                <span key={v.value_id} style={{ display: 'contents' }}>
                  <input type="radio" id={id} name={`rating-${r.id}`} checked={vals[r.id] === v.value_id} onChange={() => setVals((s) => ({ ...s, [r.id]: v.value_id }))} />
                  <label htmlFor={id} title={`${v.value} star${v.value === '1' ? '' : 's'}`}>
                    <span className="sr-only">
                      {v.value} star{v.value === '1' ? '' : 's'}
                    </span>
                  </label>
                </span>
              );
            })}
          </fieldset>
        </div>
      ))}
      <div className="ts-field is-required">
        <label htmlFor="rv-nick">Nickname</label>
        <input id="rv-nick" required maxLength={60} value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
      </div>
      <div className="ts-field is-required">
        <label htmlFor="rv-sum">Summary</label>
        <input id="rv-sum" required maxLength={120} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
      </div>
      <div className="ts-field is-required">
        <label htmlFor="rv-text">Review</label>
        <textarea id="rv-text" required rows={5} maxLength={4000} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
      </div>
      {msg && (
        <p className={`ts-msg ts-msg--${msg.ok ? 'success' : 'error'}`} role="status">
          {msg.text}
        </p>
      )}
      <button type="submit" className="ts-button" disabled={busy}>
        {busy ? 'Submitting' : 'Submit Review'}
      </button>
    </form>
  );
}
