'use client';
import { useLocale } from 'next-intl';
import { useParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { SUPPORTED_LOCALES, type Locale } from '@bricoloc/shared';
import { KioskFrame } from '@/components/kiosk/KioskFrame';

const T: Record<Locale, { q: string; qA: string; sub: string; back: string }> = {
  fr: {
    q: 'Quel est votre',
    qA: 'projet ?',
    sub: 'On filtre le catalogue sur les bons outils.',
    back: '← Retour',
  },
  nl: {
    q: 'Wat is uw',
    qA: 'project?',
    sub: 'We filteren de catalogus op het juiste gereedschap.',
    back: '← Terug',
  },
  en: {
    q: 'What is your',
    qA: 'project?',
    sub: 'We’ll filter the catalogue to the right tools.',
    back: '← Back',
  },
};

/** Chaque projet ouvre le catalogue borne pré-filtré sur une catégorie. */
const PROJECTS: { key: string; icon: string; label: Record<Locale, string>; category: string }[] = [
  {
    key: 'renover',
    icon: '🏠',
    label: { fr: 'Rénover une pièce', nl: 'Een kamer renoveren', en: 'Renovate a room' },
    category: 'peintures-finitions',
  },
  {
    key: 'sol',
    icon: '🪵',
    label: { fr: 'Poser un sol', nl: 'Een vloer leggen', en: 'Lay a floor' },
    category: 'travail-du-bois',
  },
  {
    key: 'peindre',
    icon: '🎨',
    label: { fr: 'Peindre', nl: 'Schilderen', en: 'Paint' },
    category: 'peintures-finitions',
  },
  {
    key: 'demolir',
    icon: '🧱',
    label: { fr: 'Démolir / percer', nl: 'Slopen / boren', en: 'Demolish / drill' },
    category: 'forer-casser',
  },
  {
    key: 'beton',
    icon: '🪨',
    label: { fr: 'Béton & maçonnerie', nl: 'Beton & metselwerk', en: 'Concrete & masonry' },
    category: 'beton-pierre',
  },
  {
    key: 'jardin',
    icon: '🌿',
    label: { fr: 'Jardin & extérieur', nl: 'Tuin & buiten', en: 'Garden & outdoors' },
    category: 'exterieur',
  },
  {
    key: 'nettoyer',
    icon: '💧',
    label: { fr: 'Nettoyer', nl: 'Schoonmaken', en: 'Clean' },
    category: 'nettoyage',
  },
  {
    key: 'hauteur',
    icon: '🪜',
    label: { fr: 'Travailler en hauteur', nl: 'Op hoogte werken', en: 'Work at height' },
    category: 'echelles-echafaudages',
  },
];

export default function BorneProjet() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const locale = useLocale() as Locale;
  const t = T[locale] ?? T.fr;

  const switchLocale = (l: Locale) =>
    // @ts-expect-error params dynamiques transmis tels quels
    router.replace({ pathname, params }, { locale: l });

  return (
    <KioskFrame step={2} locale={locale} locales={SUPPORTED_LOCALES} onLocale={switchLocale}>
      <div className="kiosk-pad">
        <button className="kiosk-back kiosk-back--inline" onClick={() => router.push('/borne')}>
          {t.back}
        </button>
        <h1>
          {t.q}
          <br />
          <i>{t.qA}</i>
        </h1>
        <p className="kiosk-sub">{t.sub}</p>

        <div className="kiosk-grid2 kiosk-grid2--projects">
          {PROJECTS.map((p) => (
            <button
              key={p.key}
              className="kiosk-tile"
              onClick={() => router.push(`/borne/catalogue?category=${p.category}`)}
            >
              <span className="kiosk-tile__ic" aria-hidden>
                {p.icon}
              </span>
              <span className="kiosk-tile__t">{p.label[locale] ?? p.label.fr}</span>
            </button>
          ))}
        </div>
      </div>
    </KioskFrame>
  );
}
