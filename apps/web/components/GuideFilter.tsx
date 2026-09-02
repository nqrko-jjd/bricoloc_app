'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { GuideSummary } from '@/lib/types';

export function GuideFilter({
  guides,
  categories,
}: {
  guides: GuideSummary[];
  categories: string[];
}) {
  const t = useTranslations('guides');
  const [cat, setCat] = useState<string>('');
  const [q, setQ] = useState('');

  const catLabel = (c: string) => {
    try {
      return t(`cat_${c}` as never);
    } catch {
      return c;
    }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return guides.filter(
      (g) =>
        (!cat || g.category === cat) &&
        (!needle ||
          g.title.toLowerCase().includes(needle) ||
          g.excerpt.toLowerCase().includes(needle)),
    );
  }, [guides, cat, q]);

  return (
    <>
      <div className="guide-toolbar">
        <div className="chips">
          <button
            type="button"
            className={`chip${!cat ? ' active' : ''}`}
            onClick={() => setCat('')}
          >
            {t('all')}
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`chip${cat === c ? ' active' : ''}`}
              onClick={() => setCat(c)}
            >
              {catLabel(c)}
            </button>
          ))}
        </div>
        <input
          className="guide-search"
          type="search"
          placeholder={t('search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="muted" style={{ marginTop: 24 }}>
          {t('emptyCat')}
        </p>
      ) : (
        <ul className="guide-grid">
          {filtered.map((g) => (
            <li key={g.slug}>
              <Link href={`/conseils/${g.slug}`} className="guide-card" data-tone={g.tone}>
                <span className="guide-card__meta">
                  <span>{catLabel(g.category)}</span>
                  <span>
                    ◷ {g.readMinutes} {t('min')}
                  </span>
                </span>
                <span className="guide-card__title">{g.title}</span>
                <span className="guide-card__excerpt">{g.excerpt}</span>
                <span className="guide-card__cta">
                  {t('read')} <span aria-hidden>→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
