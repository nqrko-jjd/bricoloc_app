/**
 * i18n BRICOLOC — 3 langues FR / NL / EN.
 * - `SUPPORTED_LOCALES` / `Locale` viennent de constants.ts.
 * - Le FR est la langue **source** : c'est celle que l'équipe saisit, NL/EN sont
 *   auto-traduits (DeepL) puis corrigeables en admin.
 * - Les champs traduisibles en base sont stockés en JSON : `{ fr, nl, en }` (`I18nText`).
 */
import { SUPPORTED_LOCALES, type Locale } from './constants.js';

/** Langue source : saisie par l'équipe, jamais auto-traduite. */
export const SOURCE_LOCALE: Locale = 'fr';

/** Langue par défaut du site (= source). */
export const DEFAULT_LOCALE: Locale = 'fr';

/** Cibles de traduction automatique (DeepL). */
export const AUTO_TRANSLATE_TARGETS: Locale[] = SUPPORTED_LOCALES.filter(
  (l): l is Locale => l !== SOURCE_LOCALE,
);

export interface LocaleMeta {
  /** code court */
  code: Locale;
  /** libellé dans la langue courante de l'UI */
  label: string;
  /** libellé dans sa propre langue (pour le sélecteur) */
  nativeLabel: string;
  /** valeur de l'attribut html lang + hreflang */
  htmlLang: string;
  /** locale Open Graph */
  ogLocale: string;
  /** code DeepL (source / cible) */
  deepl: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  fr: {
    code: 'fr',
    label: 'Français',
    nativeLabel: 'Français',
    htmlLang: 'fr-BE',
    ogLocale: 'fr_BE',
    deepl: 'FR',
  },
  nl: {
    code: 'nl',
    label: 'Néerlandais',
    nativeLabel: 'Nederlands',
    htmlLang: 'nl-BE',
    ogLocale: 'nl_BE',
    deepl: 'NL',
  },
  en: {
    code: 'en',
    label: 'Anglais',
    nativeLabel: 'English',
    htmlLang: 'en',
    ogLocale: 'en_GB',
    deepl: 'EN-GB',
  },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Forme d'un champ traduisible stocké en base (Json). */
export type I18nText = Partial<Record<Locale, string>>;

/**
 * Résout un champ traduisible pour une langue donnée, avec repli.
 * Accepte aussi une simple `string` (champ non encore migré) ou null.
 * Ordre de repli : langue demandée → langue source → 1re valeur non vide.
 */
export function pickText(
  field: I18nText | string | null | undefined,
  locale: Locale,
  fallbackLocale: Locale = SOURCE_LOCALE,
): string {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  const direct = field[locale];
  if (direct && direct.trim()) return direct;
  const fb = field[fallbackLocale];
  if (fb && fb.trim()) return fb;
  for (const l of SUPPORTED_LOCALES) {
    const v = field[l];
    if (v && v.trim()) return v;
  }
  return '';
}

/** Construit un `I18nText` à partir d'une valeur source (FR). */
export function makeI18nText(sourceValue: string, locale: Locale = SOURCE_LOCALE): I18nText {
  return { [locale]: sourceValue };
}

/** Vrai si au moins une cible de traduction manque (à (re)traduire). */
export function needsTranslation(field: I18nText | null | undefined): boolean {
  if (!field) return false;
  const src = field[SOURCE_LOCALE];
  if (!src || !src.trim()) return false;
  return AUTO_TRANSLATE_TARGETS.some((l) => !field[l] || !field[l]!.trim());
}
