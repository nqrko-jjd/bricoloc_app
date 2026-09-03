'use client';

import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';

export type PackCard = {
  slug: string;
  name: string;
  intro: string;
  family: string;
  level: string | null;
  teamSize: string | null;
  popular: boolean;
  dailyPrice: number;
  separateTotal: number | null;
  toolCount: number;
  image: string | null;
};

const FAM_LABEL: Record<string, string> = {
  peinture: 'Peinture',
  'sols-bois': 'Sols & bois',
  carrelage: 'Carrelage',
  'gros-oeuvre': 'Gros œuvre',
  plomberie: 'Plomberie',
  electricite: 'Électricité',
  jardin: 'Jardin',
  nettoyage: 'Nettoyage',
  hauteur: 'Hauteur',
  manutention: 'Manutention',
};

export function PackFilter({
  packs,
  families,
}: {
  packs: PackCard[];
  families: [string, string][];
}) {
  const [fam, setFam] = useState('tous');

  const counts = useMemo(() => {
    const c: Record<string, number> = { tous: packs.length };
    for (const p of packs) c[p.family] = (c[p.family] ?? 0) + 1;
    return c;
  }, [packs]);

  const shown = fam === 'tous' ? packs : packs.filter((p) => p.family === fam);

  return (
    <section className="bp-list">
      <div className="bp-tabs" role="tablist">
        {families.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={fam === key}
            className={`bp-tab${fam === key ? ' is-on' : ''}`}
            onClick={() => setFam(key)}
            disabled={key !== 'tous' && !counts[key]}
          >
            {label}
            {counts[key] ? <span className="bp-tab__n">{counts[key]}</span> : null}
          </button>
        ))}
      </div>

      <p className="bp-list__hint">
        {shown.length} solution{shown.length > 1 ? 's' : ''} — cliquez sur un pack pour voir son
        contenu.
      </p>

      <div className="bp-grid">
        {shown.map((p) => (
          <Link key={p.slug} href={`/bricopacks/${p.slug}`} className="bp-card">
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="bp-card__img" src={p.image} alt="" loading="lazy" />
            ) : (
              <span className="bp-card__img bp-card__img--ph" aria-hidden />
            )}
            <span className="bp-card__tag">{FAM_LABEL[p.family] ?? p.family}</span>
            {p.popular && <span className="bp-card__pop">Populaire</span>}
            <span className="bp-card__name">{p.name}</span>
            <span className="bp-card__intro">{p.intro}</span>
            <span className="bp-card__foot">
              <span className="bp-card__meta">
                {p.toolCount} outils{p.teamSize ? ` · ${p.teamSize}` : ''}
              </span>
              <span className="bp-card__cta">Voir le contenu →</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
