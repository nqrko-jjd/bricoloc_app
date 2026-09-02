/**
 * Traduit les guides FR → NL/EN via DeepL (champ i18n).
 * Idempotent : ne retraduit pas ce qui est déjà rempli (option --force pour tout refaire).
 *
 *   npx tsx scripts/translate-guides.ts [--force]
 */
import '../src/env.js';
import { prisma } from '../src/db.js';
import { translateFields, translationEnabled } from '../src/lib/translate.js';

async function main() {
  if (!translationEnabled()) {
    console.error('DEEPL_API_KEY absente — traduction impossible.');
    process.exit(1);
  }
  const force = process.argv.includes('--force');
  const guides = await prisma.guide.findMany();
  let done = 0;
  for (const g of guides) {
    const existing = (g.i18n as Record<string, Record<string, string>> | null) ?? {};
    const i18n = await translateFields(
      { title: g.title, excerpt: g.excerpt, body: g.body },
      existing as never,
      { force },
    );
    await prisma.guide.update({ where: { id: g.id }, data: { i18n: i18n as never } });
    done++;
    console.log(`  ✓ ${g.slug}`);
  }
  console.log(`${done} guides traduits.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
