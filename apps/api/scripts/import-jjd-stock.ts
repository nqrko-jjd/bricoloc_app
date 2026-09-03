/**
 * Import du parc réel JJD (fichiers « Gestion Stock » de David, sept. 2026).
 *
 *   npx tsx scripts/import-jjd-stock.ts          # applique
 *   npx tsx scripts/import-jjd-stock.ts --undo   # annule (supprime les brouillons créés)
 *
 * Deux volets, d'après les décisions validées par David sur le worksheet de
 * rapprochement (artifact « Rapprochement du parc BRICOLOC ») :
 *
 *  • AJOUTER (94)  → nouveaux produits MACHINE en **brouillon** (published:false,
 *    dailyPrice:0) + leurs exemplaires, avec l'emplacement dépôt relevé dans le
 *    fichier JJD. Le code JJD (« O-0119 ») est conservé dans `supplierRef`.
 *    David complète ensuite prix / photos / description / catégorie avant publication.
 *
 *  • GARDER (14)   → déjà au catalogue ; on se contente de reporter l'emplacement
 *    dépôt sur les exemplaires qui n'en ont pas.
 *
 * Idempotent : relancer ne recrée pas les produits déjà présents (clé = supplierRef).
 */
import '../src/env.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/db.js';
import { newQrToken } from '../src/lib/qr.js';

type AddRow = { code: string; name: string; stock: number; used: number; total: number; rack: string };
type KeepRow = AddRow & { target: string };

const data = JSON.parse(
  readFileSync(fileURLToPath(new URL('./data/jjd-stock.json', import.meta.url)), 'utf8'),
) as { keep: KeepRow[]; add: AddRow[] };

const UNDO = process.argv.includes('--undo');

const BRANDS = [
  'Bosch', 'Makita', 'DeWalt', 'Metabo', 'Milwaukee', 'Festool', 'Flex', 'Hilti', 'Hitachi', 'AEG',
  'Stihl', 'Stiga', 'Kärcher', 'Karcher', 'Kranzle', 'Husqvarna', 'Altrex', 'Battipav', 'Eibenstock',
  'Rothenberger', 'Rems', 'Geberit', 'Prebena', 'Paslode', 'Spit', 'Fein', 'Stanley', 'Fatmax', 'SDMO',
  'Eurom', 'Vaporetto', 'Edma', 'Mondelin', 'Mafell', 'Graco', 'Grako', 'Wagner', 'Testo', 'Piher',
  'Nupi', 'Rapid', 'M-Tec', 'Arrow', 'Prodiaxio', 'Remko', 'Rigid', 'Ridgid', 'AGP', 'Futech', 'Xceed',
];

function brandOf(name: string): string | null {
  const low = name.toLowerCase();
  const hit = BRANDS.find((b) => low.includes(b.toLowerCase()));
  if (hit) return hit === 'Karcher' ? 'Kärcher' : hit === 'Grako' ? 'Graco' : hit === 'Rigid' ? 'RIDGID' : hit;
  if (/^h\s+te|^te\s?\d|^sf\s?\d|^gfb\s/i.test(name)) return 'Hilti';
  return null;
}

const CAT_RULES: [RegExp, string][] = [
  [/echa(f|l)|echelle|toit|tower|crochet de faite|remorque echafaudage/i, 'echelles-echafaudages'],
  [/carrelage|coupe-bord|battipav|prodiaxio|carotteuse|eibenstock|carrelette/i, 'beton-pierre'],
  [/ponceuse|scie|rabot|defonceuse|affleur|lamello|domino|mafell|scie sabre|scie sauteuse|circulaire|agrafeu|grafer|scie cloche/i, 'travail-du-bois'],
  [/peinture|airless|hvlp|pulver|graco|grako|wagner|pulverisateur/i, 'peintures-finitions'],
  [/chaleur|canon|deshumid|chauff|eurom|remko|reheat|hkg|amt 80/i, 'chauffage-deshumidification'],
  [/nettoyeur|karcher|kranzle|kärcher|vapor|aspirateur|aspiro|aspi /i, 'nettoyage'],
  [/tonde|debrouss|taille-haie|broyeur|souffleur|stihl|stiga|jardin|epandeur|coupe-bord/i, 'exterieur'],
  [/souder|soudeu|cintr|sertiss|rothenberger|rems|geberit|nupi|furet|niron|romax|manchoneuse/i, 'plomberie-electricite'],
  [/perfo|piqueur|burineur|meuleuse|meul\.|disqueuse|foret|marteau|percuss|hm12|hr\d|dhr|te ?6|te60/i, 'forer-casser'],
  [/laser|niveau|scanner|detecteur|camera|odometre|inspection|line tracker|multicross|pm30/i, 'forer-casser'],
];
function catSlugOf(name: string): string | null {
  for (const [re, slug] of CAT_RULES) if (re.test(name)) return slug;
  return null;
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);

async function uniqueSlug(base: string): Promise<string> {
  let s = base || 'machine';
  for (let i = 0; ; i++) {
    const cand = i ? `${s}-${i + 1}` : s;
    if (!(await prisma.product.findUnique({ where: { slug: cand } }))) return cand;
  }
}
async function uniqueAsset(base: string): Promise<string> {
  for (let i = 0; ; i++) {
    const cand = i ? `${base}-${i + 1}` : base;
    if (!(await prisma.productUnit.findUnique({ where: { assetTag: cand } }))) return cand;
  }
}

async function undo() {
  const codes = data.add.map((a) => a.code);
  const prods = await prisma.product.findMany({
    where: { supplierRef: { in: codes }, published: false, dailyPrice: 0 },
    include: { _count: { select: { reservationItems: true, cartItems: true } } },
  });
  let del = 0;
  for (const p of prods) {
    if (p._count.reservationItems || p._count.cartItems) {
      console.log(`  ! ${p.slug} — utilisé (réservation/panier), conservé`);
      continue;
    }
    await prisma.product.delete({ where: { id: p.id } }); // cascade units
    del++;
  }
  console.log(`Annulé : ${del} produit(s) supprimé(s).`);
}

async function run() {
  const cats = await prisma.category.findMany({ select: { id: true, slug: true } });
  const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

  // ---- AJOUTER ----
  let created = 0;
  let skipped = 0;
  let units = 0;
  for (const row of data.add) {
    const existing = await prisma.product.findFirst({ where: { supplierRef: row.code } });
    if (existing) {
      skipped++;
      continue;
    }
    const brand = brandOf(row.name);
    const slug = await uniqueSlug(norm(row.name));
    const catSlug = catSlugOf(row.name);
    const p = await prisma.product.create({
      data: {
        slug,
        name: row.name,
        kind: 'MACHINE',
        brand,
        supplier: 'BRICOLOC',
        supplierRef: row.code,
        categoryId: catSlug ? catId[catSlug] ?? null : null,
        dailyPrice: 0,
        deposit: 0,
        availabilityMode: 'INSTANT',
        deliveryPolicy: 'STANDARD',
        isDemo: false,
        published: false,
      },
    });
    created++;
    const n = Math.max(row.total, 1);
    for (let i = 0; i < n; i++) {
      const tag = await uniqueAsset(n === 1 ? row.code : `${row.code}-${String(i + 1).padStart(2, '0')}`);
      await prisma.productUnit.create({
        data: {
          productId: p.id,
          assetTag: tag,
          qrToken: newQrToken('U'),
          state: 'AVAILABLE',
          storageLocation: row.rack || null,
        },
      });
      units++;
    }
  }

  // ---- GARDER : reporter l'emplacement ----
  let located = 0;
  const notFound: string[] = [];
  for (const row of data.keep) {
    if (!row.rack) continue;
    const prod = await prisma.product.findFirst({
      where: { name: { equals: row.target } },
      include: { units: true },
    });
    if (!prod) {
      notFound.push(row.target);
      continue;
    }
    const r = await prisma.productUnit.updateMany({
      where: { productId: prod.id, storageLocation: null },
      data: { storageLocation: row.rack },
    });
    located += r.count;
  }

  console.log(`\nAJOUTER : ${created} produit(s) créé(s) en brouillon, ${units} exemplaire(s). ${skipped} déjà présents.`);
  console.log(`GARDER  : emplacement reporté sur ${located} exemplaire(s).`);
  if (notFound.length) console.log(`  produits « garder » non retrouvés par nom : ${notFound.join(' · ')}`);
  console.log(`\nÀ compléter par David en admin : prix J/S/M, photos, description, catégorie, puis publier.`);
  console.log(`Filtre admin : catalogue → brouillons (published:false).`);
}

(UNDO ? undo() : run())
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
