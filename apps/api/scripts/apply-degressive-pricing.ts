/**
 * Applique la grille dégressive « Option A » (validée par David, sept. 2026) à
 * toutes les machines du parc BRICOLOC (hors Loiselet, hors accessoires/packs).
 *
 *   npx tsx scripts/apply-degressive-pricing.ts --dry   # rapport, rien écrit
 *   npx tsx scripts/apply-degressive-pricing.ts         # applique
 *
 * Grille (X = tarif jour) :
 *   • tiers : [{minDays:1, perDay:X}, {minDays:3, perDay:0,35·X}]
 *     → chaque jour au-delà de 2 facturé à −65 %.
 *   • weekPrice  = 3,5·X   (forfait semaine, −50 %)
 *   • monthPrice = 12·X    (forfait mois, −60 %)
 *   Le moteur (packages/shared/pricing.ts) prend toujours le moins cher entre
 *   tarif dégressif jour, forfait semaine et forfait mois → courbe continue :
 *   3 j −22 % · 4 j −30 % · 5 j −37 % · 7 j −50 % · mois −60 %.
 *
 * Ne touche PAS une machine qui a déjà des `tiers` personnalisés (David les a
 * réglés à la main) — seulement signalée.
 */
import '../src/env.js';
import { prisma } from '../src/db.js';

const DRY = process.argv.includes('--dry');
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Arrondi au demi-euro pour les tarifs > 4 € (plus lisible sur la fiche). */
const perDay3 = (x: number) => (x >= 4 ? Math.round(x * 0.35 * 2) / 2 : r2(x * 0.35));

async function main() {
  const machines = await prisma.product.findMany({
    where: { supplier: 'BRICOLOC', kind: 'MACHINE', dailyPrice: { gt: 0 } },
    select: { id: true, slug: true, dailyPrice: true, weekPrice: true, monthPrice: true, tiers: true },
    orderBy: { slug: 'asc' },
  });

  let changed = 0;
  let skippedCustom = 0;
  for (const p of machines) {
    const x = p.dailyPrice;
    const hasCustomTiers = Array.isArray(p.tiers) && (p.tiers as unknown[]).length > 0;
    if (hasCustomTiers) {
      skippedCustom++;
      console.log(`  = ${p.slug} — tiers déjà personnalisés, laissé tel quel`);
      continue;
    }
    const tiers = [
      { minDays: 1, perDay: r2(x) },
      { minDays: 3, perDay: perDay3(x) },
    ];
    const weekPrice = Math.round(x * 3.5);
    const monthPrice = Math.round(x * 12);

    console.log(
      `  ${p.slug.padEnd(44)} ${String(x).padStart(5)}€/j` +
        `  ·  dès 3j ${tiers[1]!.perDay}€/j` +
        `  ·  sem ${p.weekPrice ?? '—'}→${weekPrice}` +
        `  ·  mois ${p.monthPrice ?? '—'}→${monthPrice}`,
    );
    if (!DRY) {
      await prisma.product.update({ where: { id: p.id }, data: { tiers, weekPrice, monthPrice } });
    }
    changed++;
  }

  console.log(
    `\n${DRY ? '[DRY RUN — rien écrit]  ' : ''}${changed} machine(s) mise(s) à jour` +
      ` · ${skippedCustom} avec tiers personnalisés laissée(s).`,
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
