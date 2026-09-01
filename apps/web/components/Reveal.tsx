'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Révélations au scroll : ajoute `.is-visible` aux éléments `.reveal` quand ils
 * entrent dans le viewport (une seule fois). Respecte `prefers-reduced-motion`
 * (le CSS force alors l'état visible). Monté une fois dans le layout du site.
 */
export function Reveal() {
  const pathname = usePathname();

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal:not(.is-visible)'));
    if (els.length === 0) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const el = e.target as HTMLElement;
            const delay = el.dataset.revealDelay;
            if (delay) el.style.transitionDelay = `${delay}ms`;
            el.classList.add('is-visible');
            io.unobserve(el);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));

    // filet de sécurité si l'IO ne se déclenche pas (onglet caché au chargement…)
    const t = window.setTimeout(() => els.forEach((el) => el.classList.add('is-visible')), 2500);

    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, [pathname]);

  return null;
}
