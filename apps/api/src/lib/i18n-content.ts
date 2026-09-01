/**
 * Traduction automatique des contenus éditoriaux (`Content`).
 * Modèle : une ligne par (key, locale). Le FR est la source.
 * Quand le FR change, on (re)génère les lignes NL/EN via DeepL, SAUF si un humain
 * les a revues (`reviewedAt` non nul) — sauf `force`.
 */
import { AUTO_TRANSLATE_TARGETS, SOURCE_LOCALE, type Locale } from '@bricoloc/shared';
import { prisma } from '../db.js';
import { deeplTranslate, translationEnabled } from './translate.js';

export interface ContentSource {
  key: string;
  title?: string | null;
  body: string;
  format?: string;
}

/** (Re)traduit un contenu FR vers NL/EN. Renvoie la liste des locales écrites. */
export async function syncContentTranslations(
  src: ContentSource,
  opts: { force?: boolean; targets?: Locale[] } = {},
): Promise<Locale[]> {
  if (!translationEnabled()) return [];
  const targets = opts.targets ?? AUTO_TRANSLATE_TARGETS;
  const html = (src.format ?? 'markdown') === 'html';
  const written: Locale[] = [];

  for (const locale of targets) {
    if (locale === SOURCE_LOCALE) continue;
    const existing = await prisma.content.findUnique({
      where: { key_locale: { key: src.key, locale } },
    });
    if (existing?.reviewedAt && !opts.force) continue;

    try {
      const [title, body] = await Promise.all([
        src.title ? deeplTranslate([src.title], locale).then((r) => r[0]) : Promise.resolve(null),
        deeplTranslate([src.body], locale, { html }).then((r) => r[0]),
      ]);
      await prisma.content.upsert({
        where: { key_locale: { key: src.key, locale } },
        create: {
          key: src.key,
          locale,
          title: title ?? undefined,
          body: body ?? src.body,
          format: src.format ?? 'markdown',
          autoTranslated: true,
        },
        update: {
          title: title ?? undefined,
          body: body ?? src.body,
          format: src.format ?? 'markdown',
          autoTranslated: true,
          reviewedAt: null,
        },
      });
      written.push(locale);
    } catch (err) {
      console.warn(`[i18n-content] ${src.key}/${locale} échec:`, (err as Error).message);
    }
  }
  return written;
}
