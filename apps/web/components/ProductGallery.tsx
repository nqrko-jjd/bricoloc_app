'use client';

import { useState } from 'react';
import { PLACEHOLDER_IMG } from '@/lib/placeholder';

/** Galerie photo produit : image principale + vignettes cliquables. */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const list = images.length ? images : [PLACEHOLDER_IMG];
  const [active, setActive] = useState(0);

  return (
    <div className="pgallery">
      <div className="pgallery__main">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={list[active]}
          alt={alt}
          onError={(e) => ((e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMG)}
        />
      </div>
      {list.length > 1 && (
        <ul className="pgallery__thumbs">
          {list.map((src, i) => (
            <li key={src + i}>
              <button
                type="button"
                className={i === active ? 'is-active' : undefined}
                onClick={() => setActive(i)}
                aria-label={`Photo ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src.replace(/\.webp$/, '.thumb.webp')}
                  alt=""
                  loading="lazy"
                  onError={(e) => ((e.currentTarget as HTMLImageElement).src = src)}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
