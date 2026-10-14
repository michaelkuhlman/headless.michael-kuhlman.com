'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../Icon';

export interface TabDef {
  id: string;
  label: string;
  count?: number;
  content: React.ReactNode;
}

/** Tabs from 768px, an accordion on phones (same as the classic product page). */
export function Tabs({ tabs }: { tabs: TabDef[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const [openAcc, setOpenAcc] = useState<Record<string, boolean>>({ [tabs[0]?.id]: true });

  useEffect(() => {
    const f = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      setActive(id);
      setOpenAcc((o) => ({ ...o, [id]: true }));
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
    };
    window.addEventListener('ts:tab', f);
    if (location.hash === '#reviews' || location.hash === '#review-form') f(new CustomEvent('ts:tab', { detail: 'reviews' }));
    return () => window.removeEventListener('ts:tab', f);
  }, []);

  return (
    <section className="ts-tabs" aria-label="Product details">
      <div className="ts-tabs__list" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            className="ts-tabs__tab"
            onClick={() => setActive(t.id)}
          >
            {t.label}
            {t.count != null && ` (${t.count})`}
          </button>
        ))}
      </div>
      <div className="ts-tabs__wrap">
        {tabs.map((t) => {
          const accOpen = !!openAcc[t.id];
          return (
            <div key={t.id} id={t.id} style={{ scrollMarginTop: 90 }}>
              <button type="button" className="ts-tabs__acc" aria-expanded={accOpen} onClick={() => setOpenAcc((o) => ({ ...o, [t.id]: !accOpen }))}>
                <span>
                  {t.label}
                  {t.count != null && ` (${t.count})`}
                </span>
                <Icon name="chevD" />
              </button>
              <div
                className="ts-tabs__panel"
                role="tabpanel"
                id={`panel-${t.id}`}
                aria-labelledby={`tab-${t.id}`}
                data-tab-active={active === t.id ? '1' : '0'}
                data-acc-open={accOpen ? '1' : '0'}
              >
                {t.content}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
