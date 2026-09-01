'use client';

import { useLocale } from 'next-intl';
import { useParams } from 'next/navigation';
import { useTransition } from 'react';
import { SUPPORTED_LOCALES, LOCALE_META, type Locale } from '@bricoloc/shared';
import { usePathname, useRouter } from '@/i18n/navigation';

/** Sélecteur de langue FR / NL / EN — conserve la page courante. */
export function LanguageSwitcher({ variant = 'header' }: { variant?: 'header' | 'footer' }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale) return;
    startTransition(() => {
      // @ts-expect-error -- params dynamiques transmis tels quels
      router.replace({ pathname, params }, { locale: next });
    });
  }

  return (
    <div className={`lang-switch lang-switch--${variant}`} aria-label="Langue">
      {SUPPORTED_LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          disabled={isPending}
          aria-current={l === locale ? 'true' : undefined}
          className={l === locale ? 'is-active' : undefined}
          title={LOCALE_META[l].nativeLabel}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
