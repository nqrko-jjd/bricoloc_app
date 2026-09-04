'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Link, useRouter, usePathname } from '@/i18n/navigation';
import { SUPPORTED_LOCALES, type Locale } from '@bricoloc/shared';
import { wipeSession, exitKiosk } from '@/lib/kiosk';
import { KioskKeyboard } from './KioskKeyboard';

const IDLE_MS = 120_000;

/**
 * Coque plein écran de la borne tactile. Pas de châssis dessiné : la page
 * OCCUPE l'écran (orientation libre). En-tête réduit au strict minimum :
 * le logo à gauche, le choix de la langue à droite — rien d'autre (ni
 * navigation, ni pied de page). Remise à zéro après 2 min d'inactivité.
 */
export function KioskShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const locale = useLocale() as Locale;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        {/* Appui long (3 s) sur le logo = sortie de la borne (personnel). */}
        <Link
          href="/borne"
          className="kioskm__logo"
          aria-label="Bricoloc"
          onClick={wipeSession}
          onPointerDown={() => {
            const to = setTimeout(() => {
              exitKiosk();
              window.location.href = '/';
            }, 3000);
            const cancel = () => {
              clearTimeout(to);
              window.removeEventListener('pointerup', cancel);
              window.removeEventListener('pointercancel', cancel);
            };
            window.addEventListener('pointerup', cancel);
            window.addEventListener('pointercancel', cancel);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/logo-bricoloc.webp" alt="Bricoloc" />
        </Link>

        {/* Rien d'autre que le logo (à gauche) et le choix de langue (à droite). */}
        <div className="kioskm__actions">
          {SUPPORTED_LOCALES.map((l) => (
            <button
              key={l}
              className={`kioskm__lang${l === locale ? ' is-on' : ''}`}
              onClick={() =>
                // @ts-expect-error params dynamiques transmis tels quels
                router.replace({ pathname, params }, { locale: l })
              }
              aria-label={l.toUpperCase()}
              aria-current={l === locale}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <div className="kioskm__body">{children}</div>

      <KioskKeyboard />
    </div>
  );
}
