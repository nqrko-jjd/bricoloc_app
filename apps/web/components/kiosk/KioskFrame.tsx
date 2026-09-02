'use client';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@bricoloc/shared';

const EXIT_LABEL: Record<string, string> = {
  fr: '← Retour au site',
  nl: '← Terug naar site',
  en: '← Back to site',
};

/** Étapes du parcours de commande borne (déclenché depuis l'accueil). */
export const KIOSK_STEPS = [
  'Accueil',
  'Projet',
  'Catalogue',
  'Dates',
  'Panier',
  'Paiement',
  'Confirmation',
];

/**
 * Cadre de la borne tactile verticale (style concept) : écran clair arrondi
 * dans un châssis navy posé sur un pied. En-tête minimal (logo + aide + panier
 * + langue). Pas de barre de navigation sur l'accueil ; `step` affiche une
 * fine progression pendant le parcours de commande.
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
  const nextLocale = locales[(locales.indexOf(locale) + 1) % locales.length];

  return (
    <>
      <div className="kiosk-topline">
        <Link href="/" className="kiosk-exit">
          {EXIT_LABEL[locale] ?? EXIT_LABEL.fr}
        </Link>
      </div>

      <section className="kiosk-device">
        <div className="kiosk-bezel">
          <div className="kiosk-screen">
            <div className="kiosk-screen__top">
              <Link href="/borne" className="logo kiosk-logo" aria-label="Bricoloc">
                <span className="b">BRICO</span>
                <span className="l">LOC</span>
              </Link>
              <div className="kiosk-screen__actions">
                <button
                  className="kiosk-circle"
                  onClick={() => onLocale(nextLocale)}
                  aria-label="Changer de langue"
                >
                  {locale.toUpperCase()}
                </button>
                <button className="kiosk-circle" onClick={onHelp} aria-label="Aide">
                  ?
                </button>
                <Link href="/borne/panier" className="kiosk-circle kiosk-circle--cart" aria-label="Panier">
                  🛒
                  {cartCount > 0 ? <span>{cartCount}</span> : null}
                </Link>
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

            <div className={`kiosk-screen__body${step ? ' kiosk-screen__body--process' : ''}`}>
              {children}
            </div>
          </div>
        </div>
        <div className="kiosk-neck" aria-hidden />
        <div className="kiosk-foot-stand" aria-hidden />
      </section>
    </>
  );
}
