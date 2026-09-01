/**
 * Traduction automatique FR -> NL/EN via DeepL.
 *
 * - Le **français est la source** ; on ne traduit jamais vers le FR.
 * - Tolérant aux pannes : si la clé manque ou si l'API échoue, on renvoie ce
 *   qu'on a (souvent rien) sans jamais throw — l'appelant garde la version FR.
 * - Cache : mémoire (process) + base (`Translation`) pour ne pas re-payer les
 *   mêmes segments. DeepL free = 1 M caractères / mois.
 */
import { createHash } from 'node:crypto';
import {
  SOURCE_LOCALE,
  AUTO_TRANSLATE_TARGETS,
  LOCALE_META,
  type Locale,
  type I18nText,
} from '@bricoloc/shared';
import { env } from '../env.js';
import { prisma } from '../db.js';

export const translationEnabled = () => env.deeplApiKey.length > 0;

const memCache = new Map<string, string>();
const memKey = (text: string, target: Locale) => `${target}:${sha(text)}`;
function sha(s: string): string {
  return createHash('sha1').update(s).digest('hex');
}

interface DeeplResponse {
  translations: { text: string; detected_source_language: string }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sérialise les appels DeepL (l'offre gratuite plafonne la concurrence) et
 * espace les requêtes, pour éviter les 429.
 */
let deeplChain: Promise<unknown> = Promise.resolve();
function withDeeplQueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = deeplChain.then(fn, fn);
  deeplChain = run.then(
    () => sleep(120),
    () => sleep(120),
  );
  return run;
}

/**
 * Traduit un lot de segments FR -> `target`. Respecte l'ordre.
 * `tagHandling: 'html'` pour préserver un balisage simple dans les contenus.
 */
export async function deeplTranslate(
  texts: string[],
  target: Locale,
  opts: { html?: boolean } = {},
): Promise<string[]> {
  if (!translationEnabled() || target === SOURCE_LOCALE || texts.length === 0) {
    return texts;
  }
  const body = new URLSearchParams();
  for (const t of texts) body.append('text', t);
  body.set('source_lang', LOCALE_META[SOURCE_LOCALE].deepl);
  body.set('target_lang', LOCALE_META[target].deepl);
  if (opts.html) body.set('tag_handling', 'html');

  return withDeeplQueue(async () => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${env.deeplApiHost}/v2/translate`, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${env.deeplApiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
      if (res.ok) {
        const json = (await res.json()) as DeeplResponse;
        return json.translations.map((t) => t.text);
      }
      // 429 / 529 = surcharge : back-off exponentiel (max 5 essais).
      if ((res.status === 429 || res.status === 529) && attempt < 5) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      throw new Error(`DeepL ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
  });
}

/** Traduit un seul segment avec cache mémoire + base. */
export async function translateSegment(text: string, target: Locale): Promise<string | null> {
  const trimmed = text?.trim();
  if (!trimmed || target === SOURCE_LOCALE) return null;
  const mk = memKey(trimmed, target);
  const cached = memCache.get(mk);
  if (cached !== undefined) return cached;

  const hash = sha(trimmed);
  const row = await prisma.translation
    .findUnique({ where: { sourceHash_target: { sourceHash: hash, target } } })
    .catch(() => null);
  if (row) {
    memCache.set(mk, row.text);
    return row.text;
  }

  if (!translationEnabled()) return null;
  try {
    const [out] = await deeplTranslate([trimmed], target);
    if (!out) return null;
    memCache.set(mk, out);
    await prisma.translation
      .upsert({
        where: { sourceHash_target: { sourceHash: hash, target } },
        create: { sourceHash: hash, target, source: trimmed.slice(0, 2000), text: out },
        update: { text: out },
      })
      .catch(() => undefined);
    return out;
  } catch (err) {
    console.warn('[translate] échec DeepL:', (err as Error).message);
    return null;
  }
}

/**
 * Construit / complète un champ traduisible à partir de sa valeur source FR.
 * - Ne réécrit PAS les cibles déjà présentes sauf `force`.
 * - Renvoie toujours au moins `{ fr: source }`.
 */
export async function buildI18nText(
  source: string,
  existing: I18nText = {},
  opts: { targets?: Locale[]; force?: boolean; html?: boolean } = {},
): Promise<I18nText> {
  const out: I18nText = { ...existing, [SOURCE_LOCALE]: source };
  const src = source?.trim();
  if (!src) return out;
  const targets = opts.targets ?? AUTO_TRANSLATE_TARGETS;
  const todo = targets.filter((l) => opts.force || !out[l]?.trim());
  if (todo.length === 0) return out;

  await Promise.all(
    todo.map(async (l) => {
      const t = opts.html
        ? (await deeplTranslate([src], l, { html: true }).catch(() => [null]))[0]
        : await translateSegment(src, l);
      if (t) out[l] = t;
    }),
  );
  return out;
}

/**
 * Traduit un objet {champ: valeurFR} vers un objet {champ: I18nText}.
 * Utilisé lors de la création/édition d'un produit, d'une catégorie…
 */
export async function translateFields<K extends string>(
  fields: Record<K, string | null | undefined>,
  existing: Partial<Record<K, I18nText>> = {},
  opts: { force?: boolean; htmlFields?: K[] } = {},
): Promise<Record<K, I18nText>> {
  const entries = Object.entries(fields) as [K, string | null | undefined][];
  const result = {} as Record<K, I18nText>;
  await Promise.all(
    entries.map(async ([key, value]) => {
      if (value == null || value === '') {
        result[key] = existing[key] ?? {};
        return;
      }
      result[key] = await buildI18nText(value, existing[key] ?? {}, {
        force: opts.force,
        html: opts.htmlFields?.includes(key),
      });
    }),
  );
  return result;
}
