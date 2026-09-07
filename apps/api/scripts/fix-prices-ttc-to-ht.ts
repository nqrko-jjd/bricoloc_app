/**
 * Corrige la BASE des prix : la table tarifaire Bricoloc (« Gestion Stock » /
 * tarif 2024) est en **TTC**, mais l'import l'a stockée comme si c'était du HTVA
 * → le client voyait +21 % (agrafeuse grillage 5 € TTC affichée 6,05 €).
 *
 * Ce script divise les champs de prix par (1 + TVA) pour retrouver le vrai HTVA,
 * de sorte que le client (particulier) voie exactement le chiffre de la table.
 * `deposit` (caution, hors TVA) n'est PAS touché.
 *
 *   npx tsx scripts/fix-prices-ttc-to-ht.ts --dry            # rapport
 *   npx tsx scripts/fix-prices-ttc-to-ht.ts --scope=machines # applique (machines seules)
 *   npx tsx scripts/fix-prices-ttc-to-ht.ts --scope=machines,packs,consumables
 *
 * Scopes : machines | packs | consumables (CONSUMABLE+PPE+ACCESSORY BRICOLOC).
 * Loiselet n'est jamais touché (leurs tarifs ont leur propre base).
 * Idempotent-ish : NE PAS relancer sans --dry après un apply (rediviserait).
 */
import '../src/env.js';
import { prisma } from '../src/db.js';
import { getSettings } from '../src/lib/settings.js';

const args = process.argv.slice(2);
const DRY = args.includes('--dry') || !args.some((a) => a.startsWith('--scope='));
const scope = new Set(
  (args.find((a) => a.startsWith('--scope='))?.slice('--scope='.length) ?? '').split(',').filter(Boolean),
);

const r2 = (n: number) => Math.round(n * 100) / 100;
/** 4 décimales : garde assez de précision pour que ×(1+TVA) ré-affiche le
 * chiffre TTC rond de la table (ex. 5 € → 4,1322 → 5,00 € TTC). */
const r4 = (n: number) => Math.round(n * 10000) / 10000;

async function main() {
  const s = await getSettings();
  const vat = Number(s.vatRate ?? 0.21);
  const div = 1 + vat;
  console.log(`TVA ${Math.round(vat * 100)} % → division par ${div}${DRY ? '   [DRY RUN]' : ''}`);
  console.log(`Scopes : ${[...scope].join(', ') || '(aucun — dry run info)'}\n`);

  const kinds: string[] = [];
  if (scope.has('machines') || DRY) kinds.push('MACHINE');
  if (scope.has('packs') || DRY) kinds.push('PACK');
  if (scope.has('consumables') || DRY) kinds.push('CONSUMABLE', 'PPE', 'ACCESSORY');

  const rows = await prisma.product.findMany({
    where: { supplier: 'BRICOLOC', kind: { in: kinds }, dailyPrice: { gt: 0 } },
    select: {
      id: true, slug: true, kind: true, dailyPrice: true, weekendPrice: true,
      weekPrice: true, monthPrice: true, tiers: true,
    },
    orderBy: [{ kind: 'asc' }, { slug: 'asc' }],
  });

  const willApply = (k: string) =>
    (k === 'MACHINE' && scope.has('machines')) ||
    (k === 'PACK' && scope.has('packs')) ||
    (['CONSUMABLE', 'PPE', 'ACCESSORY'].includes(k) && scope.has('consumables'));

  let done = 0;
  const perKind: Record<string, number> = {};
  for (const p of rows) {
    // Le chiffre stocké EST le TTC voulu → on retrouve le HTVA en divisant.
    const newDaily = r4(p.dailyPrice / div);
    const newWeekend = p.weekendPrice != null ? r4(p.weekendPrice / div) : null;

    let newWeek: number | null;
    let newMonth: number | null;
    let newTiers: unknown;
    if (p.kind === 'MACHINE') {
      // Grille « Option A » calculée sur le TTC (chiffres ronds pour le client),
      // puis stockée en HTVA. Jamais au-dessus d'un forfait déjà meilleur.
      const dTTC = p.dailyPrice;
      const gWeekTTC = Math.round(dTTC * 3.5);
      const gMonthTTC = Math.round(dTTC * 12);
      const g3TTC = dTTC >= 4 ? Math.round(dTTC * 0.35 * 2) / 2 : r2(dTTC * 0.35);
      const exWeekTTC = p.weekPrice ?? Infinity;
      const exMonthTTC = p.monthPrice ?? Infinity;
      newWeek = r4(Math.min(exWeekTTC, gWeekTTC) / div);
      newMonth = r4(Math.min(exMonthTTC, gMonthTTC) / div);
      newTiers = [
        { minDays: 1, perDay: newDaily },
        { minDays: 3, perDay: r4(g3TTC / div) },
      ];
    } else {
      newWeek = p.weekPrice != null ? r4(p.weekPrice / div) : null;
      newMonth = p.monthPrice != null ? r4(p.monthPrice / div) : null;
      newTiers = Array.isArray(p.tiers)
        ? (p.tiers as { minDays: number; perDay: number }[]).map((t) => ({ ...t, perDay: r4(t.perDay / div) }))
        : p.tiers;
    }

    perKind[p.kind] = (perKind[p.kind] ?? 0) + 1;
    console.log(
      `  ${willApply(p.kind) ? '✓' : '·'} ${p.slug.padEnd(42)} ${p.kind.padEnd(10)}` +
        ` jour ${p.dailyPrice}→${newDaily}  (client ${r2(p.dailyPrice * div)}€→${r2(newDaily * div)}€ TTC)`,
    );

    if (willApply(p.kind) && !DRY) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          dailyPrice: newDaily,
          weekendPrice: newWeekend,
          weekPrice: newWeek,
          monthPrice: newMonth,
          tiers: newTiers as never,
        },
      });
      done++;
    }
  }

  console.log(`\n${DRY ? '[DRY RUN — rien écrit]  ' : ''}${done} produit(s) corrigé(s).`);
  console.log(`Par kind (dans le périmètre lu) : ${JSON.stringify(perKind)}`);
  if (DRY) console.log(`\nPour appliquer : --scope=machines[,packs][,consumables]`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
