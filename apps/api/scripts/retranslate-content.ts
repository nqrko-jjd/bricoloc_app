/**
 * (Re)traduit tous les contenus FR vers NL/EN via DeepL (queue + back-off).
 *   npx tsx scripts/retranslate-content.ts            # complète les manquants
 *   npx tsx scripts/retranslate-content.ts --force    # retraduit tout
 *   npx tsx scripts/retranslate-content.ts home.      # limite à un préfixe de clé
 */
import '../src/env.js';
import { prisma } from '../src/db.js';
import { translationEnabled } from '../src/lib/translate.js';
import { syncContentTranslations } from '../src/lib/i18n-content.js';

async function main() {
  if (!translationEnabled()) {
    console.error('DEEPL_API_KEY absente.');
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const prefix = args.find((a) => !a.startsWith('-'));

  const rows = await prisma.content.findMany({
    where: { locale: 'fr', ...(prefix ? { key: { startsWith: prefix } } : {}) },
    orderBy: { key: 'asc' },
  });
  console.log(`${rows.length} contenus FR${prefix ? ` (préfixe "${prefix}")` : ''}, force=${force}`);

  let done = 0;
  for (const c of rows) {
    const written = await syncContentTranslations(
      { key: c.key, title: c.title, body: c.body, format: c.format },
      { force },
    );
    if (written.length) done++;
    process.stdout.write(written.length ? '.' : '·');
  }
  console.log(`\n${done} contenus (re)traduits.`);

  const [fr, nl, en] = await Promise.all([
    prisma.content.count({ where: { locale: 'fr' } }),
    prisma.content.count({ where: { locale: 'nl' } }),
    prisma.content.count({ where: { locale: 'en' } }),
  ]);
  console.log({ fr, nl, en });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
