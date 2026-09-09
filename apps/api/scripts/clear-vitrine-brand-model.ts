/**
 * Nettoie marque/modèle sur les fiches vitrines (ni fiche technique, ni
 * rattachée) — champ censé être réservé aux fiches techniques mais qui a pu
 * s'y coller par erreur (copier-coller Excel via l'import CSV « products »
 * avant que ce garde-fou existe). Cause du badge « (ARROW T50) » qui apparaît
 * à côté du nom d'une vitrine générique dans le tableau admin sans qu'on
 * puisse l'éditer (le formulaire de vitrine n'a pas de champ marque/modèle).
 *
 *   npx tsx scripts/clear-vitrine-brand-model.ts --dry   # rapport, rien écrit
 *   npx tsx scripts/clear-vitrine-brand-model.ts         # applique
 */
import '../src/env.js';
import { prisma } from '../src/db.js';

const DRY = process.argv.includes('--dry');

async function main() {
  // Uniquement les MACHINE : la marque est un attribut normal sur un
  // accessoire/consommable (ex. disque diamant Bosch), pas un problème à
  // corriger. published:true seul (pas juste technical:false+sans parent) :
  // les ~50 brouillons de parc encore non rattachés (import-jjd-stock.ts)
  // sont eux aussi technical:false/sans parent mais NON publiés — ils portent
  // leur vraie marque/modèle à dessein, en attendant d'être rattachés comme
  // fiche technique. On ne touche qu'aux vitrines machine déjà publiées.
  const rows = await prisma.product.findMany({
    where: {
      kind: 'MACHINE',
      technical: false,
      parentProductId: null,
      published: true,
      OR: [{ brand: { not: null } }, { model: { not: null } }],
    },
    select: { id: true, name: true, slug: true, brand: true, model: true },
  });

  if (rows.length === 0) {
    console.log('Rien à nettoyer.');
    await prisma.$disconnect();
    return;
  }

  for (const r of rows) {
    console.log(
      `  → ${r.name} (${r.slug}) : marque="${r.brand ?? ''}" modèle="${r.model ?? ''}" -> effacées`,
    );
    if (!DRY) {
      await prisma.product.update({ where: { id: r.id }, data: { brand: null, model: null } });
    }
  }

  console.log(`\n${DRY ? '[DRY RUN — rien écrit]  ' : ''}${rows.length} fiche(s) nettoyée(s).`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
