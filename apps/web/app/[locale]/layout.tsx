import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Bricolage_Grotesque, Hanken_Grotesk } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { LOCALE_META, type Locale } from '@bricoloc/shared';
import '../globals.css';
import { Providers } from '@/lib/providers';
import { routing } from '@/i18n/routing';

/**
 * Typographie du design system Bricoloc (design-system/bricoloc/MASTER.md).
 * next/font auto-héberge les fichiers au build : aucune requête externe, aucun souci CSP.
 */
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display-src',
  display: 'swap',
});

const sans = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans-src',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bricoloc.be';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const l = (hasLocale(routing.locales, locale) ? locale : routing.defaultLocale) as Locale;

  // hreflang : une URL par langue + x-default sur le FR.
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) {
    languages[LOCALE_META[loc as Locale].htmlLang] =
      loc === routing.defaultLocale ? SITE_URL : `${SITE_URL}/${loc}`;
  }
  languages['x-default'] = SITE_URL;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: 'BRICOLOC — Location de machines et outillage',
      template: '%s · BRICOLOC',
    },
    description:
      'BRICOLOC : location de machines, outils et matériel professionnel. Réservation en ligne 24h/24, Click & Collect ou livraison sur chantier. Le bon outil, au bon moment.',
    alternates: {
      canonical: l === routing.defaultLocale ? SITE_URL : `${SITE_URL}/${l}`,
      languages,
    },
    openGraph: {
      title: 'BRICOLOC — Louez mieux, travaillez mieux',
      description:
        'Location de machines et outillage professionnel. Réservation en ligne 24h/24.',
      type: 'website',
      locale: LOCALE_META[l].ogLocale,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={LOCALE_META[locale].htmlLang} className={`${display.variable} ${sans.variable}`}>
      <body>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
