'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function Reveal() {
  const pathname = usePathname();
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const tracked = new Set<HTMLElement>();
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) {
        const el = e.target as HTMLElement;
        el.style.transitionDelay = `${Math.min(Number(el.dataset.revealDelay) || 0, 300)}ms`;
        el.classList.add('is-visible');
        io.unobserve(el);
      }
    }, { rootMargin: '0px 0px -32px 0px', threshold: 0.04 });
    const discover = () => {
      document.querySelectorAll<HTMLElement>('.reveal:not(.is-visible)').forEach((el) => {
        if (tracked.has(el)) return;
        tracked.add(el);
        // Readable by default; only offscreen content opts in to motion.
        if (preference.matches || el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add('is-visible');
        } else {
          el.classList.add('motion-ready');
          io.observe(el);
        }
      });
    };
    discover();
    const mutations = new MutationObserver(discover);
    mutations.observe(document.body, { childList: true, subtree: true });
    const revealAll = () => {
      if (preference.matches) tracked.forEach((el) => el.classList.add('is-visible'));
    };
    preference.addEventListener('change', revealAll);
    return () => {
      io.disconnect(); mutations.disconnect();
      preference.removeEventListener('change', revealAll);
      tracked.forEach((el) => el.classList.remove('motion-ready'));
    };
  }, [pathname]);
  return null;
}
