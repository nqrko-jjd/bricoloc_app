'use client';
import { useEffect, useRef } from 'react';

export function useDrawerFocus(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(ref.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]',
    ) ?? []).filter((el) => el.getClientRects().length > 0);
    // Disable background controls for assistive technology as well as Tab.
    const background = new Map<HTMLElement, boolean>();
    let branch: HTMLElement | null = ref.current;
    while (branch?.parentElement) {
      const parent: HTMLElement = branch.parentElement;
      for (const sibling of Array.from(parent.children)) {
        if (sibling === branch || !(sibling instanceof HTMLElement) || sibling.matches('script, .mobile-drawer__backdrop, .admin-side__backdrop')) continue;
        background.set(sibling, sibling.inert);
        sibling.inert = true;
      }
      if (parent === document.body) break;
      branch = parent;
    }
    focusable()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key !== 'Tab') return;
      const items = focusable();
      const first = items[0], last = items[items.length - 1];
      if (!first) { e.preventDefault(); return; }
      if (e.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      background.forEach((inert, el) => { el.inert = inert; });
      previous?.focus();
    };
  }, [open, close]);
  return ref;
}
