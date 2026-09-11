/**
 * Recherche texte insensible à la casse, compatible SQLite (dev) et
 * PostgreSQL (prod). `contains` est déjà insensible à la casse sur SQLite,
 * mais sensible sur PostgreSQL par défaut — sans quoi une recherche
 * "antichute" ne trouve pas "Antichute…". `mode: 'insensitive'` n'existe que
 * côté PostgreSQL : l'ajouter inconditionnellement casse au runtime sur
 * SQLite (le moteur local rejette l'argument), d'où le typage `any` ici,
 * volontairement plus large que le `StringFilter` généré par le provider actif.
 */
import { env } from '../env.js';

const isPostgres = /^postgres(ql)?:\/\//i.test(env.databaseUrl);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ciContains(value: string): any {
  return isPostgres ? { contains: value, mode: 'insensitive' } : { contains: value };
}
