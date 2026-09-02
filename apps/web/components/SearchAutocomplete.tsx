'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { Search, ArrowUpRight } from './icons';

interface SuggestProduct {
  slug: string;
  name: string;
  image: string | null;
  dailyPrice: number;
  category: { name: string } | null;
}
interface SuggestResponse {
  query: string;
  popular: boolean;
  products: SuggestProduct[];
  categories: { slug: string; name: string }[];
}

const MIN_CHARS = 3;

export function SearchAutocomplete({
  placeholder,
  cta,
  variant = 'hero',
  initial = '',
}: {
  placeholder: string;
  cta?: string;
  variant?: 'hero' | 'plain';
  initial?: string;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('suggest');
  const listId = useId();

  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SuggestResponse | null>(null);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  // Fermeture au clic extérieur
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Requête (debounce) : ≥ 3 car. -> recherche ; sinon liste « souvent utilisés »
  useEffect(() => {
    const term = q.trim();
    if (term.length > 0 && term.length < MIN_CHARS) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const r = await api<SuggestResponse>(
          `/api/catalog/suggest?locale=${locale}${term ? `&q=${encodeURIComponent(term)}` : ''}`,
        );
        if (!ctrl.signal.aborted) {
          setData(r);
          setActive(-1);
        }
      } catch {
        /* ignore */
      }
    }, 160);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q, locale]);

  const flat: { type: 'product' | 'category' | 'all'; href: string; label: string }[] = [];
  if (data) {
    for (const p of data.products)
      flat.push({ type: 'product', href: `/produits/${p.slug}`, label: p.name });
    for (const c of data.categories)
      flat.push({ type: 'category', href: `/catalogue?category=${c.slug}`, label: c.name });
    if (q.trim().length >= MIN_CHARS)
      flat.push({ type: 'all', href: `/catalogue?q=${encodeURIComponent(q.trim())}`, label: q.trim() });
  }

  function goTo(href: string) {
    setOpen(false);
    router.push(href);
  }
  function submit() {
    if (active >= 0 && flat[active]) return goTo(flat[active].href);
    goTo(q.trim() ? `/catalogue?q=${encodeURIComponent(q.trim())}` : '/catalogue');
  }

  const showPanel = open && data && (data.products.length > 0 || data.categories.length > 0 || (data.popular === false && q.trim().length >= MIN_CHARS));

  return (
    <div
      ref={boxRef}
      className={`search-ac search-ac--${variant}`}
      role="combobox"
      aria-expanded={showPanel ? 'true' : 'false'}
      aria-owns={listId}
      aria-haspopup="listbox"
    >
      <form
        className={variant === 'hero' ? 'csearch' : 'search-ac__bar'}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Search />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, flat.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, -1));
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
        />
        {variant === 'hero' && cta ? (
          <button type="submit">
            {cta} <ArrowUpRight />
          </button>
        ) : null}
      </form>

      {showPanel && data ? (
        <div className="search-ac__panel" id={listId} role="listbox">
          {data.popular && data.products.length > 0 ? (
            <p className="search-ac__head">{t('popular')}</p>
          ) : null}
          {!data.popular && data.products.length > 0 ? (
            <p className="search-ac__head">{t('products')}</p>
          ) : null}

          {data.products.map((p, i) => (
            <button
              key={p.slug}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={active === i}
              className={`search-ac__item${active === i ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => goTo(`/produits/${p.slug}`)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image || FALLBACK} alt="" loading="lazy" />
              <span className="search-ac__name">{p.name}</span>
              <span className="search-ac__price">
                {p.dailyPrice.toLocaleString('fr-BE', { style: 'currency', currency: 'EUR' })}
                <small>{t('perDay')}</small>
              </span>
            </button>
          ))}

          {data.categories.length > 0 ? (
            <>
              <p className="search-ac__head">{t('categories')}</p>
              {data.categories.map((c, j) => {
                const idx = data.products.length + j;
                return (
                  <button
                    key={c.slug}
                    id={`${listId}-${idx}`}
                    role="option"
                    aria-selected={active === idx}
                    className={`search-ac__item search-ac__item--cat${active === idx ? ' is-active' : ''}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => goTo(`/catalogue?category=${c.slug}`)}
                  >
                    <Search />
                    <span className="search-ac__name">{c.name}</span>
                  </button>
                );
              })}
            </>
          ) : null}

          {!data.popular && q.trim().length >= MIN_CHARS ? (
            <button
              className={`search-ac__all${active === flat.length - 1 ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(flat.length - 1)}
              onClick={() => goTo(`/catalogue?q=${encodeURIComponent(q.trim())}`)}
            >
              {data.products.length === 0 && data.categories.length === 0
                ? t('noResults', { q: q.trim() })
                : t('allResults', { q: q.trim() })}
              <ArrowUpRight />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#eeeef7"/></svg>',
  );
