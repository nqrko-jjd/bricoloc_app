'use client';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@bricoloc/shared';

/** Étapes du parcours de commande borne (déclenché par « Je décris mon projet »). */
export const KIOSK_STEPS = [
  'Projet',
  'Catalogue',
  'Choix',
  'Dates',
  'Panier',
  'Identification',
  'Paiement',
  'Confirmation',
];

/**
 * Cadre de la borne tactile — orientation portrait par défaut, bascule en
 * deux colonnes en paysage. Pas de barre de navigation sur l'accueil ;
 * `step` (1..8) affiche la progression du parcours de commande.
 */
export function KioskFrame({
  step,
  locale,
  locales,
  onLocale,
  cartCount = 0,
  onHelp,
  children,
}: {
  step?: number;
  locale: Locale;
  locales: readonly Locale[];
  onLocale: (l: Locale) => void;
  cartCount?: number;
  onHelp?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="kiosk-bezel">
      <div className="kiosk-screen">
        <div className="kiosk-screen__top">
          <Link href="/borne" className="logo kiosk-logo" aria-label="Bricoloc">
            <span className="b">BRICO</span>
            <span className="l">LOC</span>
          </Link>
          <div className="kiosk-screen__actions">
            <button className="kiosk-help" onClick={onHelp}>
              ? Aide
            </button>
            <Link href="/borne/panier" className="kiosk-cart">
              🛒{cartCount > 0 ? <span>{cartCount}</span> : null}
            </Link>
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

        {step ? (
          <div className="kiosk-progress" aria-label={`Étape ${step} sur ${KIOSK_STEPS.length}`}>
            {KIOSK_STEPS.map((s, i) => (
              <span
                key={s}
                className={`kiosk-progress__s${i + 1 === step ? ' is-active' : ''}${
                  i + 1 < step ? ' is-done' : ''
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        ) : null}

        <div className={`kiosk-screen__grid${step ? ' kiosk-screen__grid--process' : ''}`}>
          {children}
        </div>
      </div>
    </section>
  );
}
