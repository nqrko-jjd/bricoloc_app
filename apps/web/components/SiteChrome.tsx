'use client';
import type { ReactNode } from 'react';
import { usePathname } from '@/i18n/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DateRangeBar } from '@/components/DateRangeBar';
import { KioskShell } from '@/components/kiosk/KioskShell';
import { Reveal } from '@/components/Reveal';

/**
 * Choisit l'habillage du site. Le mode borne (coque tactile plein écran, ni
 * en-tête ni pied de page) n'est appliqué QUE sur le parcours borne lui-même
 * (`/borne/*` + le tunnel `/commande`), même si le cookie `bricoloc_kiosk`
 * traîne encore — sinon, avoir ouvert la borne une fois figeait tout le site.
 */
export function SiteChrome({
  kioskCookie,
  children,
}: {
  kioskCookie: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const inKioskArea =
    pathname === '/borne' ||
    pathname.startsWith('/borne/') ||
    pathname === '/commande' ||
    pathname.startsWith('/commande/');
  const isAppDemo = pathname === '/appli-demo' || pathname.startsWith('/appli-demo/');

  if (kioskCookie && inKioskArea) {
    return (
      <KioskShell>
        <main>{children}</main>
        <Reveal />
      </KioskShell>
    );
  }

  // Démo appli : ni en-tête ni pied de page (même logique que la borne),
  // la page gère elle-même tout son habillage plein écran.
  if (isAppDemo) {
    return <main>{children}</main>;
  }

  return (
    <>
      <Header />
      <DateRangeBar />
      <main>{children}</main>
      <Footer />
      <Reveal />
    </>
  );
}
