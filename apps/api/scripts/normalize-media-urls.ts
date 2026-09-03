/**
 * Rend relatifs les liens média (`http://host/uploads/…` -> `/uploads/…`) stockés
 * en base. Le middleware `relativizeMedia` le fait déjà à la volée sur les
 * réponses, mais autant nettoyer la base après une migration.
 *
 *   npx tsx scripts/normalize-media-urls.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const RE = "https?://[^/\"]+(/uploads/)";

async function run() {
  // [table, colonne, type] — 'json' = champ Json (cast ::jsonb), 'text' = String
  const targets: [string, string, 'json' | 'text'][] = [
    ['Product', 'images', 'json'],
    ['MediaAsset', 'url', 'text'],
    ['Content', 'i18n', 'json'],
    ['Guide', 'i18n', 'json'],
  ];
  for (const [table, col, kind] of targets) {
    try {
      const expr =
        kind === 'json'
          ? `regexp_replace("${col}"::text, $1, '\\1', 'g')::jsonb`
          : `regexp_replace("${col}", $1, '\\1', 'g')`;
      const n = await prisma.$executeRawUnsafe(
        `UPDATE "${table}" SET "${col}" = ${expr} WHERE "${col}"::text LIKE '%://%/uploads/%'`,
        RE,
      );
      console.log(`  ${table}.${col}: ${n} ligne(s)`);
    } catch (e) {
      console.log(`  ${table}.${col}: ${(e as Error).message.slice(0, 90)}`);
    }
  }
  await prisma.$disconnect();
}
run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
