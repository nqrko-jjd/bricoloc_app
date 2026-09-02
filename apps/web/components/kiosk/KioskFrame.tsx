'use client';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@bricoloc/shared';

const STEPS = [
  'Accueil',
  'Projet',
  'Catalogue',
  'Fiche outil',
  'Dates',
  'Panier',
  'Identification',
  'Paiement',
  'Confirmation',
];

/**
 * Cadre de la borne tactile (style concept) : barre d'étapes, châssis navy,
 * écran clair arrondi avec en-tête (logo + aide + panier), corps en 2 colonnes.
 */
export function KioskFrame({
  step,
  locale,
  locales,
  onLocale,
  cartCount = 0,
  children,
}: {
  step: number;
  locale: Locale;
  locales: readonly Locale[];
  onLocale: (l: Locale) => void;
  cartCount?: number;
  children: ReactNode;
}) {
  return (
    <>
      <header className="kiosk-head">
        <Link href="/" className="kiosk-back">
          ← Retour au site
        </Link>
        <div className="kiosk-stepbar" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={`kiosk-stepbar__s${i + 1 === step ? ' is-active' : ''}`}>
              {i + 1}. {s}
            </span>
          ))}
        </div>
      </header>

      <section className="kiosk-bezel">
        <div className="kiosk-screen">
          <div className="kiosk-screen__top">
            <span className="logo kiosk-logo" aria-label="Bricoloc">
              <span className="b">BRICO</span>
              <span className="l">LOC</span>
            </span>
            <div className="kiosk-screen__actions">
              <button className="kiosk-help">? Besoin d’aide&nbsp;?</button>
              <button className="kiosk-cart">
                🛒 Panier{cartCount > 0 ? <span>{cartCount}</span> : null}
              </button>
              <div className="kiosk-langs">
                {locales.map((l) => (
                  <button
                    key={l}
                    className={l === locale ? 'is-active' : ''}
                    onClick={() => onLocale(l)}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="kiosk-screen__grid">{children}</div>
        </div>
      </section>
    </>
  );
}
