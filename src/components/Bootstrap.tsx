'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { loadCart } from '@/lib/client/cart';
import { Icon } from './Icon';

/** Client start-up: load the bag after first paint, reveal-on-scroll (like the classic theme), back to top. */
export function Bootstrap() {
  const path = usePathname();
  const [top, setTop] = useState(false);

  useEffect(() => {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(() => void loadCart(), { timeout: 1500 });
    else setTimeout(() => void loadCart(), 200);
    const f = () => setTop(window.scrollY > 1200);
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const root = document.documentElement;
    const els = Array.from(document.querySelectorAll<HTMLElement>('.ts-main .ts-section, .ts-main .ts-spotlight, .ts-main .ts-story, .ts-main .ts-strip'));
    const vh = window.innerHeight;
    // only what starts below the fold fades in: nothing visible on load ever waits on JS
    const below = els.filter((el) => el.getBoundingClientRect().top > vh * 0.9 && !el.classList.contains('ts-reveal'));
    if (!below.length) return;
    root.classList.add('ts-motion');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    below.forEach((el) => {
      el.classList.add('ts-reveal');
      io.observe(el);
    });
    return () => io.disconnect();
  }, [path]);

  return (
    <button type="button" className={`ts-top${top ? ' is-on' : ''}`} aria-label="Back to top" tabIndex={top ? 0 : -1} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
      <Icon name="arrowUp" />
    </button>
  );
}
