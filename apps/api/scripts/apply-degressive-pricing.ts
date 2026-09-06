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
import { suggestDegressivePricing } from '@bricoloc/shared';
import { prisma } from '../src/db.js';

const DRY = process.argv.includes('--dry');

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
    const suggested = suggestDegressivePricing(x);
    const tiers = suggested.tiers;
    // Ne jamais AUGMENTER un forfait : si David avait déjà mis mieux que
    // ×3,5 / ×12, on le garde.
    const weekPrice = Math.min(p.weekPrice ?? Infinity, suggested.weekPrice);
    const monthPrice = Math.min(p.monthPrice ?? Infinity, suggested.monthPrice);

    console.log(
      `  ${p.slug.padEnd(44)} ${String(x).padStart(5)}€/j` +
        `  ·  dès 3j ${tiers[1]!.perDay}€/j` +
        `  ·  sem ${p.weekPrice ?? '—'}→${weekPrice}` +
        `  ·  mois ${p.monthPrice ?? '—'}→${monthPrice}`,
    );
    if (!DRY) {
      await prisma.product.update({
        where: { id: p.id },
        data: { tiers: tiers as never, weekPrice, monthPrice },
      });
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
