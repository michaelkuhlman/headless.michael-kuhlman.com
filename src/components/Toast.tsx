'use client';

import Link from 'next/link';
import { useToast } from '@/lib/client/ui';

export function Toast() {
  const t = useToast();
  return (
    <div className={`ts-toast${t ? ' is-on' : ''}`} role="status" aria-live="polite">
      {t && (
        <>
          {t.text}
          {t.href && <Link href={t.href}>{t.link ?? 'View'}</Link>}
        </>
      )}
    </div>
  );
}
