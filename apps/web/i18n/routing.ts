import { defineRouting } from 'next-intl/routing';
import { SUPPORTED_LOCALES, SOURCE_LOCALE } from '@bricoloc/shared';

/**
 * Routing i18n du site Bricoloc.
 * - 3 langues : fr (source, à la racine), nl, en.
 * - `localePrefix: 'as-needed'` → le FR reste sur `/`, le NL sur `/nl/…`, l'EN sur `/en/…`.
 */
export const routing = defineRouting({
  locales: [...SUPPORTED_LOCALES],
  defaultLocale: SOURCE_LOCALE,
  localePrefix: 'as-needed',
  localeCookie: {
    // 1 an
    maxAge: 60 * 60 * 24 * 365,
  },
});
