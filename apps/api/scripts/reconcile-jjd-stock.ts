/**
 * Recale le parc JJD déjà importé (94 « add » + 14 « keep », voir
 * import-jjd-stock.ts) sur un export plus récent du registre JJD
 * (« Gestion Stock - Machines (1).xlsx »).
 *
 * Ne touche QUE les 108 codes déjà connus (identiques à l'import initial) :
 *  - resynchronise le nombre d'exemplaires (ajoute/retire des AVAILABLE),
 *  - resynchronise l'emplacement dépôt,
 *  - complète la catégorie manquante sur les brouillons (heuristique élargie).
 * N'ajoute JAMAIS de nouveau produit tout seul : les codes présents dans le
 * fichier mais absents des 108 déjà revus par David sont seulement listés
 * dans le rapport, pour qu'il décide (comme pour le premier lot).
 *
 * Sans argument, relit l'instantané déjà exporté et commité
 * (`data/jjd-stock-refresh-2026-09.json`) — donc rejouable tel quel en prod
 * (conteneur Docker, pas de xlsx nécessaire). Pour repartir d'un xlsx plus
 * récent, passer son chemin en argument (relit + regénère l'instantané).
 *
 *   npx tsx scripts/reconcile-jjd-stock.ts [--dry]
 *   npx tsx scripts/reconcile-jjd-stock.ts "C:/chemin/Gestion Stock - Machines (2).xlsx" [--dry]
 */
import '../src/env.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/db.js';
import { newQrToken } from '../src/lib/qr.js';
import { readTable } from './lib/table-read.js';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const xlsxArg = args.find((a) => !a.startsWith('--'));
const SNAPSHOT_URL = new URL('./data/jjd-stock-refresh-2026-09.json', import.meta.url);

const known = JSON.parse(
  readFileSync(fileURLToPath(new URL('./data/jjd-stock.json', import.meta.url)), 'utf8'),
) as {
  keep: { code: string; name: string; stock: number; used: number; total: number; rack: string; target: string }[];
  add: { code: string; name: string; stock: number; used: number; total: number; rack: string }[];
};
const knownCodes = new Set([...known.add.map((a) => a.code), ...known.keep.map((k) => k.code)]);

// ---- Heuristiques catégorie (élargies vs import-jjd-stock.ts) ----
const CAT_RULES: [RegExp, string][] = [
  [/echa(f|l)|echelle|toit|tower|crochet de faite|remorque echafaudage|etai\b/i, 'echelles-echafaudages'],
  [/carrelage|coupe-bord|battipav|prodiaxio|carotteuse|eibenstock|carrelette|ponceuse a beton|meuleuse a beton/i, 'beton-pierre'],
  [/ponceuse|scie|rabot|defonceuse|affleur|lamello|domino|mafell|scie sabre|scie sauteuse|circulaire|agrafeu|grafer|scie cloche|cloueur|visseuse/i, 'travail-du-bois'],
  [/peinture|airless|hvlp|pulver|graco|grako|wagner|pulverisateur|pistolet/i, 'peintures-finitions'],
  [/chaleur|canon|deshumid|chauff|eurom|remko|reheat|hkg|amt 80|radiateur|ventilateur/i, 'chauffage-deshumidification'],
  [/nettoyeur|karcher|kranzle|kärcher|vapor|aspirateur|aspiro|aspi |balayeuse/i, 'nettoyage'],
  [/tonde|debrouss|taille-haie|broyeur|souffleur|stihl|stiga|jardin|epandeur|coupe-bord|tronconneuse|elagueuse/i, 'exterieur'],
  [/souder|soudeu|cintr|sertiss|rothenberger|rems|geberit|nupi|furet|niron|romax|manchoneuse|degorgeoir/i, 'plomberie-electricite'],
  [/perfo|piqueur|burineur|meuleuse|meul\.|disqueuse|foret|marteau|percuss|hm12|hr\d|dhr|te ?6|te60|burin/i, 'forer-casser'],
  [/laser|niveau|scanner|detecteur|camera|odometre|inspection|line tracker|multicross|pm30|lampe|projecteur|generateur|groupe electro/i, 'forer-casser'],
  [/trolley|makpac|caisse|malette|coffret|chariot|diable|brouette/i, 'exterieur'],
];
// Codes/modèles réels non-descriptifs (juste marque+référence) reconnus à la
// main — seulement ceux dont l'identification est fiable, le reste reste
// « non classé » plutôt que d'être deviné au hasard.
const MODEL_HINTS: [RegExp, string][] = [
  [/\bDGA5?06\b|\bGA50\d\d|\bGA90\d\d|\b9558HN\b|\bGMS ?120\b/i, 'forer-casser'], // meuleuses d'angle, détecteur multimatériaux
  [/\bDF330D\b|\bDHP481\b|\bTD ?090D\b|\bSF ?6H-?22\b/i, 'forer-casser'], // perceuses/visseuses à choc
  [/\bDJV18\d|\bDHS680\b|\bDJR188\b|\bMT55CC\b|\bRAIL M(AKITA|AFF?EL)\b/i, 'travail-du-bois'], // scie plongeante/sauteuse/circulaire + rails
  [/\bHBS100\b|\bRO150\b|\bDCF300\b|\bDTM ?51\b|\bTM3010\b|\bRP2300FC/i, 'travail-du-bois'], // scie ruban, ponceuse, visseuse, multi-outil, défonceuse
  [/\bKGS216\b|\bFMS200\b|\bT50\b(?!.*ETAI)/i, 'travail-du-bois'], // scie à onglet, tronçonneuse métal, agrafeuse
  [/\bGN900SE\b|\bFN18\s?GS\b|\bPRP ?ES40\b|\bAIRTAC ?PB131\b|\bGX100\b/i, 'travail-du-bois'], // cloueurs
  [/\bDCG ?180\b/i, 'peintures-finitions'], // pistolet à mastic
  [/\bTS100R\b|\bM300\b|\bLHS-?E ?225\b|\bAUGE A MORTIER\b/i, 'beton-pierre'], // scie carrelage, machine à enduire, scie murale, auge
  [/\bVC3011L\b|\bGFB ?6X-?22\b/i, 'nettoyage'], // aspirateur, souffleur
  [/\bLSV ?5-?225\b/i, 'forer-casser'], // rainureuse murale
  [/\bCAM\.? ?INS\.?\b/i, 'forer-casser'], // caméra d'inspection
];

function catSlugOf(name: string): string | null {
  for (const [re, slug] of MODEL_HINTS) if (re.test(name)) return slug;
  for (const [re, slug] of CAT_RULES) if (re.test(name)) return slug;
  return null;
}

interface SheetRow {
  code: string;
  name: string;
  /** stock + en utilisation = total réellement possédé (pas juste ce qui est au dépôt maintenant). */
  total: number;
  location: string | null;
}

function parseFromXlsx(path: string): { rows: SheetRow[]; dupCodes: string[] } {
  const raw = readTable(path);
  const rows: SheetRow[] = [];
  const seen = new Map<string, number>();
  const dupCodes: string[] = [];
  for (const r of raw) {
    const ref = (r['reference de la machine'] ?? '').trim();
    if (!ref) continue;
    const [codeRaw, ...rest] = ref.split(' - ');
    const code = (codeRaw ?? '').trim();
    if (!code) continue;
    seen.set(code, (seen.get(code) ?? 0) + 1);
    if (seen.get(code) === 2) dupCodes.push(code);
    const name = rest.join(' - ').trim().replace(/\s+/g, ' ') || code;
    const stock = Number.parseInt(r['qte en stock'] ?? '0', 10) || 0;
    const used = Number.parseInt(r['qte en utilisation'] ?? '0', 10) || 0;
    const locRaw = (r['ref chantier zone depot'] ?? '').trim();
    const location = locRaw.replace(/^Dépôt\s*:\s*/i, '').trim() || null;
    rows.push({ code, name, total: Math.max(stock + used, 1), location: locRaw.startsWith('Dépôt') ? location : null });
  }
  return { rows, dupCodes };
}

function dupCodesOf(rows: SheetRow[]): string[] {
  const seen = new Map<string, number>();
  const dups: string[] = [];
  for (const r of rows) {
    seen.set(r.code, (seen.get(r.code) ?? 0) + 1);
    if (seen.get(r.code) === 2) dups.push(r.code);
  }
  return dups;
}

/** xlsx fourni en argument → reparse + régénère l'instantané ; sinon relit l'instantané commité. */
function parseSheet(): { rows: SheetRow[]; dupCodes: string[]; source: string } {
  if (xlsxArg) {
    const { rows, dupCodes } = parseFromXlsx(xlsxArg);
    if (!dry) {
      writeFileSync(
        SNAPSHOT_URL,
        JSON.stringify({ exportedAt: new Date().toISOString(), source: xlsxArg, rows }, null, 1),
      );
    }
    return { rows, dupCodes, source: xlsxArg };
  }
  const snap = JSON.parse(readFileSync(SNAPSHOT_URL, 'utf8')) as { source: string; rows: SheetRow[] };
  return { rows: snap.rows, dupCodes: dupCodesOf(snap.rows), source: `instantané commité (${snap.source})` };
}

async function uniqueAsset(base: string): Promise<string> {
  for (let i = 0; ; i++) {
    const cand = i ? `${base}-${i + 1}` : base;
    if (!(await prisma.productUnit.findUnique({ where: { assetTag: cand } }))) return cand;
  }
}

async function syncProduct(productId: string, code: string, targetStock: number, location: string | null) {
  const units = await prisma.productUnit.findMany({ where: { productId } });
  const available = units.filter((u) => u.state === 'AVAILABLE');
  const locked = units.length - available.length; // RENTED/ON_SITE/MAINTENANCE... jamais touchés
  const wantAvailable = Math.max(0, targetStock - locked);

  let unitsCreated = 0;
  let unitsRemoved = 0;
  let locationsUpdated = 0;

  if (wantAvailable > available.length) {
    const toAdd = wantAvailable - available.length;
    for (let i = 0; i < toAdd; i++) {
      const tag = await uniqueAsset(`${code}-X${available.length + i + 1}`);
      if (!dry) {
        await prisma.productUnit.create({
          data: { productId, assetTag: tag, qrToken: newQrToken('U'), state: 'AVAILABLE', storageLocation: location },
        });
      }
      unitsCreated++;
    }
  } else if (wantAvailable < available.length) {
    const toRemove = available.slice(wantAvailable).map((u) => u.id);
    if (toRemove.length && !dry) await prisma.productUnit.deleteMany({ where: { id: { in: toRemove } } });
    unitsRemoved = toRemove.length;
  }

  if (location) {
    const r = !dry
      ? await prisma.productUnit.updateMany({
          where: { productId, state: 'AVAILABLE', OR: [{ storageLocation: null }, { storageLocation: { not: location } }] },
          data: { storageLocation: location },
        })
      : { count: available.filter((u) => u.storageLocation !== location).length };
    locationsUpdated = r.count;
  }

  return { unitsCreated, unitsRemoved, locationsUpdated };
}

async function main() {
  const { rows, dupCodes, source } = parseSheet();
  const byCode = new Map(rows.map((r) => [r.code, r]));
  console.log(`Source : ${source}`);
  console.log(`${rows.length} ligne(s) lue(s)${dry ? '  [DRY RUN — rien n\'est écrit]' : ''}\n`);

  if (dupCodes.length) console.log(`⚠️  Code(s) en double dans le fichier : ${dupCodes.join(', ')}\n`);

  // ---- 1. « add » (94 brouillons) : resync stock + emplacement ----
  let created = 0, removed = 0, relocated = 0, notInSheet = 0, catFixed = 0;
  for (const a of known.add) {
    const prod = await prisma.product.findFirst({ where: { supplierRef: a.code } });
    if (!prod) continue; // pas encore importé (ne devrait pas arriver)
    const row = byCode.get(a.code);
    if (!row) {
      notInSheet++;
      continue;
    }
    const { unitsCreated, unitsRemoved, locationsUpdated } = await syncProduct(prod.id, a.code, row.total, row.location);
    created += unitsCreated;
    removed += unitsRemoved;
    relocated += locationsUpdated;
    if (!prod.categoryId) {
      const slug = catSlugOf(row.name || prod.name);
      if (slug) {
        const cat = await prisma.category.findUnique({ where: { slug } });
        if (cat && !dry) await prisma.product.update({ where: { id: prod.id }, data: { categoryId: cat.id } });
        if (cat) catFixed++;
      }
    }
  }

  // ---- 2. « keep » (14 déjà au catalogue) : resync emplacement + code fournisseur ----
  let keepRelocated = 0, keepNotFound: string[] = [];
  for (const k of known.keep) {
    const prod = await prisma.product.findFirst({ where: { name: k.target } });
    if (!prod) {
      keepNotFound.push(k.target);
      continue;
    }
    if (!prod.supplierRef && !dry) await prisma.product.update({ where: { id: prod.id }, data: { supplierRef: k.code } });
    const row = byCode.get(k.code);
    if (row?.location) {
      const r = !dry
        ? await prisma.productUnit.updateMany({
            where: { productId: prod.id, OR: [{ storageLocation: null }, { storageLocation: { not: row.location } }] },
            data: { storageLocation: row.location },
          })
        : { count: 0 };
      keepRelocated += r.count;
    }
  }

  // ---- 3. Lignes jamais reconciliées (ni add ni keep) : rapport seul, rien créé ----
  const unreviewed = rows.filter((r) => !knownCodes.has(r.code));
  const byCat = new Map<string, SheetRow[]>();
  for (const r of unreviewed) {
    const slug = catSlugOf(r.name) ?? 'non-classé';
    if (!byCat.has(slug)) byCat.set(slug, []);
    byCat.get(slug)!.push(r);
  }

  console.log('--- Lot connu (94 add + 14 keep) ---');
  console.log(`Exemplaires ajoutés : ${created} · retirés : ${removed} · emplacement mis à jour : ${relocated + keepRelocated}`);
  console.log(`Catégorie complétée automatiquement : ${catFixed}`);
  if (notInSheet) console.log(`⚠️  ${notInSheet} code(s) « add » absents du fichier actuel (potentiellement retirés du parc JJD, à vérifier)`);
  if (keepNotFound.length) console.log(`⚠️  produit(s) « keep » introuvables par nom : ${keepNotFound.join(' · ')}`);

  console.log(`\n--- Lignes du fichier jamais revues (${unreviewed.length}/${rows.length}) ---`);
  for (const [slug, list] of [...byCat.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${slug.padEnd(28)} ${String(list.length).padStart(3)}  — ${list.slice(0, 4).map((r) => r.name).join(' · ')}${list.length > 4 ? ' …' : ''}`);
  }

  const stillNoCategory = await prisma.product.count({ where: { supplierRef: { startsWith: 'O-' }, categoryId: null } });
  const stillNoImage = await prisma.product.findMany({ where: { supplierRef: { startsWith: 'O-' } }, select: { images: true } });
  const noImgCount = stillNoImage.filter((p) => !(Array.isArray(p.images) && (p.images as unknown[]).length)).length;
  console.log(`\n--- État des 94 brouillons ---`);
  console.log(`Sans catégorie : ${stillNoCategory}/94 (avant ce script il y en avait 45)`);
  console.log(`Sans photo     : ${noImgCount}/94 — aucune source de photo trouvée, à fournir par David avant publication.`);
  console.log(`Sans prix      : tous (dailyPrice=0 par design, à compléter par David).`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
