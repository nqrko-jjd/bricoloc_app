import { cookies } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { SiteChrome } from '@/components/SiteChrome';

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Le cookie borne est posé par le middleware sur /borne*. SiteChrome ne
  // l'honore que sur le parcours borne (/borne/* + /commande) pour ne pas
  // basculer tout le site en mode borne.
  const kioskCookie = (await cookies()).get('bricoloc_kiosk')?.value === '1';

  return <SiteChrome kioskCookie={kioskCookie}>{children}</SiteChrome>;
}
