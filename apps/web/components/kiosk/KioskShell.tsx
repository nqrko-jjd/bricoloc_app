'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { useParams, usePathname as useNextPathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Link, useRouter, usePathname } from '@/i18n/navigation';
import { SUPPORTED_LOCALES, type Locale } from '@bricoloc/shared';
import { useCart } from '@/lib/providers';
import { exitKiosk, wipeSession } from '@/lib/kiosk';
import { KioskKeyboard } from './KioskKeyboard';

const IDLE_MS = 120_000;

const L: Record<string, { restart: string; res: string; help: string; exit: string }> = {
  fr: { restart: 'Recommencer', res: 'Ma réservation', help: 'Aide', exit: 'Quitter' },
  nl: { restart: 'Opnieuw', res: 'Mijn reservering', help: 'Hulp', exit: 'Sluiten' },
  en: { restart: 'Restart', res: 'My booking', help: 'Help', exit: 'Exit' },
};

/**
 * Coque plein écran de la borne tactile. Pas de châssis dessiné : la page
 * OCCUPE l'écran (orientation libre). En-tête : logo officiel + langue +
 * « Ma réservation » + panier + Recommencer. Remise à zéro automatique après
 * 2 min d'inactivité.
 */
export function KioskShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const nextPath = useNextPathname();
  const params = useParams();
  const locale = useLocale() as Locale;
  const t = L[locale] ?? L.fr;
  const { cart } = useCart();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const count = cart?.itemCount ?? 0;
  const nextLocale = SUPPORTED_LOCALES[(SUPPORTED_LOCALES.indexOf(locale) + 1) % SUPPORTED_LOCALES.length];

  // Remise à zéro sur inactivité.
  useEffect(() => {
    function reset() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        wipeSession();
        if (pathname !== '/borne') router.push('/borne');
        else location.reload();
      }, IDLE_MS);
    }
    const ev = ['pointerdown', 'keydown', 'touchstart'];
    ev.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      ev.forEach((e) => window.removeEventListener(e, reset));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pathname, router]);

  const home = pathname === '/borne';

  return (
    <div className="kioskm">
      <header className="kioskm__bar">
        <Link href="/borne" className="kioskm__logo" aria-label="Bricoloc" onClick={wipeSession}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/logo-bricoloc.webp" alt="Bricoloc" />
        </Link>

        <div className="kioskm__actions">
          {!home && (
            <button
              className="kioskm__btn"
              onClick={() => {
                wipeSession();
                router.push('/borne');
              }}
            >
              <span aria-hidden>↺</span> {t.restart}
            </button>
          )}
          <Link href="/borne/reservation" className="kioskm__btn">
            <span aria-hidden>▣</span> {t.res}
          </Link>
          <Link href="/panier" className="kioskm__btn kioskm__btn--cart">
            <span aria-hidden>🛒</span>
            {count > 0 && <span className="kioskm__badge">{count}</span>}
          </Link>
          <button
            className="kioskm__btn"
            onClick={() =>
              // @ts-expect-error params dynamiques transmis tels quels
              router.replace({ pathname, params }, { locale: nextLocale })
            }
            aria-label="Langue"
          >
            {locale.toUpperCase()}
          </button>
          <button
            className="kioskm__btn kioskm__btn--exit"
            onClick={() => {
              exitKiosk();
              window.location.href = nextPath.replace(/\/borne.*$/, '') || '/';
            }}
          >
            {t.exit}
          </button>
        </div>
      </header>

      <div className="kioskm__body">{children}</div>

      <KioskKeyboard />
    </div>
  );
}
