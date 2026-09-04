import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { LOCALE_META, type Locale } from '@bricoloc/shared';
import '../globals.css';
import { Providers } from '@/lib/providers';
import { routing } from '@/i18n/routing';

/**
 * Typographie : police système (concept Bricoloc 2026) — aucun webfont chargé,
 * rendu identique aux maquettes ChatGPT. Les tokens vivent dans globals.css.
 */
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

  const META: Record<string, { title: string; desc: string; og: string }> = {
    fr: {
      title: 'BRICOLOC — Location d’outils, simple et locale',
      desc:
        'Location de machines et d’outillage professionnel. Réservation en ligne 24h/24, retrait en 2h ou livraison partout en Belgique.',
      og: 'BRICOLOC — Louez mieux, travaillez mieux',
    },
    nl: {
      title: 'BRICOLOC — Eenvoudige, lokale gereedschapsverhuur',
      desc:
        'Verhuur van machines en professioneel gereedschap. 24/7 online reserveren, ophalen binnen 2u of levering in heel België.',
      og: 'BRICOLOC — Huur slimmer, werk beter',
    },
    en: {
      title: 'BRICOLOC — Simple, local tool rental',
      desc:
        'Rental of machines and professional tools. Book online 24/7, pick up in 2h or get delivery across Belgium.',
      og: 'BRICOLOC — Rent smarter, work better',
    },
  };
  const m = META[l] ?? META.fr;

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: m.title, template: '%s · BRICOLOC' },
    description: m.desc,
    alternates: {
      canonical: l === routing.defaultLocale ? SITE_URL : `${SITE_URL}/${l}`,
      languages,
    },
    openGraph: {
      title: m.og,
      description: m.desc,
      type: 'website',
      locale: LOCALE_META[l].ogLocale,
    },
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'BRICOLOC',
    },
    icons: {
      apple: '/img/apple-touch-icon.png',
      icon: [
        { url: '/img/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/img/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
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
    <html lang={LOCALE_META[locale].htmlLang} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
      </head>
      <body>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
