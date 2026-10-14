/** Focus helpers shared by the dialogs (bag drawer, quick view). */

let last: HTMLElement | null = null;
if (typeof window !== 'undefined') {
  document.addEventListener('focusin', (e) => {
    const t = e.target as HTMLElement;
    if (t && t !== document.body && !t.closest('[role="dialog"]')) last = t;
  });
}

/** The element to return focus to when a dialog closes. Falls back to the last focused control when the
 *  opener lost focus (e.g. the add-to-bag button was disabled while the request ran). */
export function openerFocus(): HTMLElement | null {
  const a = document.activeElement as HTMLElement | null;
  if (a && a !== document.body && !a.closest('[role="dialog"]')) return a;
  return last && last.isConnected ? last : null;
}

/** Keep Tab / Shift+Tab inside `panel`. Call from a keydown handler. */
export function trapTab(e: KeyboardEvent, panel: HTMLElement | null) {
  if (e.key !== 'Tab' || !panel) return;
  const f = [...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])')].filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
  if (!f.length) {
    e.preventDefault();
    panel.focus();
    return;
  }
  const first = f[0];
  const lastEl = f[f.length - 1];
  const inside = panel.contains(document.activeElement);
  if (e.shiftKey && (!inside || document.activeElement === first || document.activeElement === panel)) {
    e.preventDefault();
    lastEl.focus();
  } else if (!e.shiftKey && (!inside || document.activeElement === lastEl)) {
    e.preventDefault();
    first.focus();
  }
}
