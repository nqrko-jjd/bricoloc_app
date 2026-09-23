'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PLACEHOLDER_IMG } from '@/lib/placeholder';
import { Heart } from './icons';

/** Galerie photo produit : grande image + vignettes cliquables, favori
 * intégré à la même carte (comme le reste du catalogue). */
export function ProductGallery({
  images,
  alt,
  tag,
}: {
  images: string[];
  alt: string;
  tag?: string | null;
}) {
  const t = useTranslations('product');
  const list = images.length ? images : [PLACEHOLDER_IMG];
  const [active, setActive] = useState(0);
  const [fav, setFav] = useState(false);

  return (
    <div className="pgallery">
      <div className="pgallery__main">
        {tag && <span className="pgallery__tag">{tag}</span>}
        <button
          type="button"
          className={`pgallery__fav${fav ? ' is-active' : ''}`}
          onClick={() => setFav((f) => !f)}
          aria-pressed={fav}
          aria-label={t('favorite')}
        >
          <Heart fill={fav ? 'currentColor' : 'none'} />
        </button>
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
