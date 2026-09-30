'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ChevronLeft } from './icons';

export function CategorySlider({ children, label, previous, next }: {
  children: ReactNode;
  label: string;
  previous: string;
  next: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => setEdges({
      start: track.scrollLeft <= 2,
      end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 2,
    });
    const observer = new ResizeObserver(update);
    observer.observe(track);
    track.addEventListener('scroll', update, { passive: true });
    update();
    return () => { observer.disconnect(); track.removeEventListener('scroll', update); };
  }, [children]);

  function move(direction: number) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * .8,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  return <div className="category-slider">
    <div className="ccats" ref={trackRef} role="region" aria-label={label}>{children}</div>
    <div className="category-slider__controls">
      <button type="button" onClick={() => move(-1)} disabled={edges.start} aria-label={previous}><ChevronLeft /></button>
      <button type="button" onClick={() => move(1)} disabled={edges.end} aria-label={next}><ArrowRight /></button>
    </div>
  </div>;
}
