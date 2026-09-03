'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Link, useRouter, usePathname } from '@/i18n/navigation';
import { SUPPORTED_LOCALES, type Locale } from '@bricoloc/shared';
import { useCart } from '@/lib/providers';
import { wipeSession } from '@/lib/kiosk';
import { KioskKeyboard } from './KioskKeyboard';

const IDLE_MS = 120_000;

const L: Record<string, { restart: string; res: string; help: string }> = {
  fr: { restart: 'Recommencer', res: 'Ma réservation', help: 'Aide' },
  nl: { restart: 'Opnieuw', res: 'Mijn reservering', help: 'Hulp' },
  en: { restart: 'Restart', res: 'My booking', help: 'Help' },
};

/**
 * Coque plein écran de la borne tactile. Pas de châssis dessiné : la page
 * OCCUPE l'écran (orientation libre). En-tête minimal en pastilles (logo +
 * langue + « Ma réservation » + aide + panier). Aucune sortie : on reste
 * dans la borne. Remise à zéro automatique après 2 min d'inactivité.
 */
export function KioskShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const locale = useLocale() as Locale;
  const t = L[locale] ?? L.fr;
  const { cart } = useCart();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const count = cart?.itemCount ?? 0;
  const nextLocale =
    SUPPORTED_LOCALES[(SUPPORTED_LOCALES.indexOf(locale) + 1) % SUPPORTED_LOCALES.length];
  const home = pathname === '/borne';

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
              className="kioskm__c kioskm__c--wide"
              onClick={() => {
                wipeSession();
                router.push('/borne');
              }}
            >
              <span aria-hidden>↺</span> {t.restart}
            </button>
          )}
          <button
            className="kioskm__c"
            onClick={() =>
              // @ts-expect-error params dynamiques transmis tels quels
              router.replace({ pathname, params }, { locale: nextLocale })
            }
            aria-label="Langue"
          >
            {locale.toUpperCase()}
          </button>
          <Link href="/borne/reservation" className="kioskm__c" aria-label={t.res} title={t.res}>
            ▣
          </Link>
          <Link href="/borne/conseiller" className="kioskm__c" aria-label={t.help} title={t.help}>
            ?
          </Link>
          <Link
            href="/panier"
            className="kioskm__c kioskm__c--cart"
            aria-label="Panier"
          >
            🛒
            {count > 0 && <span className="kioskm__badge">{count}</span>}
          </Link>
        </div>
      </header>

      <div className="kioskm__body">{children}</div>

      <KioskKeyboard />
    </div>
  );
}
