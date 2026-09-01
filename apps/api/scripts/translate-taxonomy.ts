/**
 * Traduit NL/EN les noms/descriptions des catégories (et re-traduit les produits
 * dont l'i18n est incomplet). À lancer après un import ou un changement de taxo.
 *   npx tsx scripts/translate-taxonomy.ts
 */
import '../src/env.js';
import { prisma } from '../src/db.js';
import { buildI18nText, translationEnabled } from '../src/lib/translate.js';
import type { I18nText } from '@bricoloc/shared';

async function main() {
  if (!translationEnabled()) {
    console.error('DEEPL_API_KEY absente.');
    process.exit(1);
  }

  const cats = await prisma.category.findMany();
  for (const c of cats) {
    const existing = (c.i18n as { name?: I18nText; description?: I18nText } | null) ?? {};
    const name = await buildI18nText(c.name, existing.name ?? {});
    const description = c.description
      ? await buildI18nText(c.description, existing.description ?? {})
      : {};
    await prisma.category.update({ where: { id: c.id }, data: { i18n: { name, description } } });
    process.stdout.write('.');
  }
  console.log(`\n${cats.length} catégories traduites.`);

  // Produits sans nom NL (import interrompu, etc.)
  const products = await prisma.product.findMany({ where: { published: true } });
  let fixed = 0;
  for (const p of products) {
    const i18n = (p.i18n as Record<string, I18nText> | null) ?? {};
    if (i18n.name?.nl && i18n.name?.en) continue;
    const next = {
      ...i18n,
      name: await buildI18nText(p.name, i18n.name ?? {}),
      shortDescription: p.shortDescription
        ? await buildI18nText(p.shortDescription, i18n.shortDescription ?? {})
        : (i18n.shortDescription ?? {}),
      description: p.description
        ? await buildI18nText(p.description, i18n.description ?? {})
        : (i18n.description ?? {}),
    };
    await prisma.product.update({ where: { id: p.id }, data: { i18n: next } });
    fixed++;
    process.stdout.write('.');
  }
  console.log(`\n${fixed} produits complétés.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
