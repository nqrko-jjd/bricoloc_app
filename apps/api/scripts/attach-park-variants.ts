/**
 * Rattache une partie des brouillons du parc (codes O-XXXX, `import-jjd-stock.ts`)
 * comme **fiches techniques** de fiches vitrines déjà publiées et soignées —
 * cf. la fonctionnalité « fiches techniques » (Product.parentProductId,
 * sept. 2026). Le brouillon garde son nom brut / sa marque / son n° de série ;
 * seule la fiche vitrine est montrée au client, avec un stock qui agrège
 * désormais les deux.
 *
 * Appariement fait à la main (identification des références par marque/
 * modèle) — uniquement les cas où l'identification est fiable. Beaucoup de
 * brouillons restent sans vitrine (aspirateurs de contenance incertaine,
 * cintreuses cuivre sans vitrine dédiée, jardin, laser, etc.) : à traiter
 * dans un prochain lot, ou en rattachant à la main dans l'admin.
 *
 *   npx tsx scripts/attach-park-variants.ts --dry   # rapport, rien écrit
 *   npx tsx scripts/attach-park-variants.ts         # applique
 */
import '../src/env.js';
import { prisma } from '../src/db.js';

const DRY = process.argv.includes('--dry');

/** code O-XXXX du brouillon -> slug de la fiche vitrine. */
const MAPPING: { code: string; vitrineSlug: string; note?: string }[] = [
  // --- confiance haute (identification de modèle sans ambiguïté) ---
  { code: 'O-0010', vitrineSlug: 'detecteur-bois-metal', note: 'Bosch GMS 120 = détecteur multimatériaux' },
  { code: 'O-0112', vitrineSlug: 'detecteur-bois-metal', note: 'scanner mural' },
  { code: 'O-0040', vitrineSlug: 'disqueuse-sans-fil-125-mm', note: 'Makita DGA506 = meuleuse sans fil 125' },
  { code: 'O-0041', vitrineSlug: 'disqueuse-230-mm', note: 'Makita GA9030R = meuleuse 230' },
  { code: 'O-0101', vitrineSlug: 'disqueuse-125-mm', note: 'Makita GA5040 = meuleuse 125' },
  { code: 'O-0039', vitrineSlug: 'disqueuse-125-mm', note: 'Makita 9558HN = meuleuse 125' },
  { code: 'O-0166', vitrineSlug: 'disqueuse-125-mm', note: 'meuleuse angulaire FX 125' },
  { code: 'O-0044', vitrineSlug: 'marteau-piqueur-12-kg-20-j', note: 'Makita HM1214C = burineur 12kg/20J' },
  { code: 'O-0047', vitrineSlug: 'marteau-perfo-piqueur-sans-fil', note: 'Makita DHR243 = perfo SDS+ sans fil' },
  { code: 'O-0045', vitrineSlug: 'outil-multifonction', note: 'Makita DTM51 = multi-outil oscillant' },
  { code: 'O-0102', vitrineSlug: 'outil-multifonction', note: 'Makita TM3010 = multi-outil oscillant' },
  { code: 'O-0060', vitrineSlug: 'perceuse-visseuse-sans-fil', note: 'Makita DHP481 = perceuse-visseuse à percussion' },
  { code: 'O-0106', vitrineSlug: 'perceuse-visseuse-sans-fil', note: 'Makita DF330D = perceuse-visseuse' },
  { code: 'O-0146', vitrineSlug: 'scie-circulaire', note: 'Makita DHS680 = scie circulaire sans fil' },
  { code: 'O-0018', vitrineSlug: 'meuleuse-a-beton-125-mm', note: 'Eibenstock EDS125 = ponceuse béton 125' },
  { code: 'O-0065', vitrineSlug: 'scie-a-onglet', note: 'Metabo KGS216 = scie à onglet' },
  { code: 'O-0103', vitrineSlug: 'rainureuse', note: 'Metabo LSV5-225 = rainureuse murale' },
  { code: 'O-0128', vitrineSlug: 'cloueur-sans-fil-15-50-mm', note: 'Milwaukee M18 FN18GS = cloueur sans fil' },
  { code: 'O-0030', vitrineSlug: 'nettoyeur-haute-pression-eau-froide', note: 'Kränzle 1152 TST' },
  { code: 'O-0139', vitrineSlug: 'nettoyeur-haute-pression-eau-froide', note: 'Kärcher K2160 TST, 200 bar' },
  { code: 'O-0075', vitrineSlug: 'sertisseuse-radiale-electro-mecanique', note: 'REMS Power-Press SE Basic' },
  { code: 'O-0016', vitrineSlug: 'agrafeuse-pneumatique-15-40mm', note: 'Edma Top Grafer 20/22' },
  { code: 'O-0069', vitrineSlug: 'cloueur-pneumatique-15-50-mm', note: 'Prebena PRP ES40' },
  { code: 'O-0020', vitrineSlug: 'canon-a-chaleur-gaz-15-kw', note: 'Eurom HKG 15 BE — 15 kW exact' },
  { code: 'O-0026', vitrineSlug: 'pulverisateur-de-peinture-airless-portable', note: 'Graco Ultra Max portatif' },
  { code: 'O-0099', vitrineSlug: 'ponceuse-excentrique-150mm', note: 'Festool RO150 = ponceuse rotex 150' },

  // --- confiance moyenne (identification plausible, à vérifier en admin) ---
  { code: 'O-0086', vitrineSlug: 'groupe-electrogene-3-5-kva', note: '⚠️ SDMO HX300 ~2,8 kVA, à confirmer' },
  { code: 'O-0021', vitrineSlug: 'malaxeur-de-mortier', note: '⚠️ Flex MX02 = malaxeur/agitateur' },
  { code: 'O-0062', vitrineSlug: 'scie-a-onglet', note: '⚠️ Metabo FMS200 = scie à onglet métal (pas bois)' },
  { code: 'O-0071', vitrineSlug: 'agrafeuse-pneumatique-15-40mm', note: '⚠️ Rapid AirTac PB131, à confirmer' },
  { code: 'O-0072', vitrineSlug: 'canon-a-chaleur-infrarouge', note: '⚠️ Reheat B3000, à confirmer' },
];

async function main() {
  const bySlug = new Map<string, { id: string; name: string }>();
  const vitrines = await prisma.product.findMany({
    where: { slug: { in: [...new Set(MAPPING.map((m) => m.vitrineSlug))] } },
    select: { id: true, slug: true, name: true },
  });
  for (const v of vitrines) bySlug.set(v.slug, v);

  let attached = 0;
  let skippedMissingVitrine = 0;
  let skippedMissingDraft = 0;
  let skippedAlready = 0;

  for (const m of MAPPING) {
    const vitrine = bySlug.get(m.vitrineSlug);
    if (!vitrine) {
      console.log(`  ✗ vitrine introuvable : ${m.vitrineSlug} (pour ${m.code})`);
      skippedMissingVitrine++;
      continue;
    }
    const draft = await prisma.product.findFirst({
      where: { supplierRef: m.code, supplier: 'BRICOLOC' },
      select: { id: true, name: true, parentProductId: true },
    });
    if (!draft) {
      console.log(`  ✗ brouillon introuvable : ${m.code}`);
      skippedMissingDraft++;
      continue;
    }
    if (draft.parentProductId === vitrine.id) {
      console.log(`  = ${m.code} déjà rattaché à « ${vitrine.name} »`);
      skippedAlready++;
      continue;
    }
    console.log(
      `  → ${m.code}  «${draft.name}»  →  « ${vitrine.name} »` + (m.note ? `   (${m.note})` : ''),
    );
    if (!DRY) {
      await prisma.product.update({
        where: { id: draft.id },
        data: { parentProductId: vitrine.id, published: false },
      });
    }
    attached++;
  }

  console.log(
    `\n${DRY ? '[DRY RUN — rien écrit]  ' : ''}${attached} rattaché(s) · ${skippedAlready} déjà bons ·` +
      ` ${skippedMissingDraft} brouillon(s) introuvable(s) · ${skippedMissingVitrine} vitrine(s) introuvable(s)`,
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
