import { api } from './api';

export interface ContentEntry {
  title: string | null;
  body: string;
  format: string;
}

/**
 * Récupère les contenus éditoriaux `prefix*` pour une langue (repli FR),
 * sous forme de fonction `t(key, fallback)`. Les contenus sont éditables en
 * back-office et auto-traduits (DeepL) ; `fallback` = texte par défaut livré.
 */
export async function loadContent(prefix: string, locale: string) {
  let map: Record<string, ContentEntry> = {};
  try {
    const res = await api<{ content: Record<string, ContentEntry> }>(
      `/api/public/content?prefix=${encodeURIComponent(prefix)}&locale=${locale}`,
      { next: { revalidate: 60 } },
    );
    map = res.content ?? {};
  } catch {
    map = {};
  }
  return {
    map,
    t(key: string, fallback = ''): string {
      return map[key]?.body?.trim() || fallback;
    },
    title(key: string, fallback = ''): string {
      return map[key]?.title?.trim() || fallback;
    },
  };
}
