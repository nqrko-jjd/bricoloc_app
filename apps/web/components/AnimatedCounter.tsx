'use client';
import { useEffect, useState } from 'react';

/**
 * Compte de 0 jusqu'à `value` au montage (une fois par montage réel — en
 * StrictMode/dev, l'effet est rejoué après un cleanup qui annule la 1re
 * frame, donc pas de double-comptage sans avoir besoin d'une ref-garde qui
 * bloquerait justement ce 2e passage, le seul qui compte).
 */
export function AnimatedCounter({
  value,
  suffix = '',
  durationMs = 1100,
}: {
  value: number;
  suffix?: string;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(eased * value));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return (
    <>
      {display}
      {suffix}
    </>
  );
}
