/** Vérifie la qualité du matching AVANT import. Ne touche pas la base. */
import {
  loadWoo,
  loadTarif,
  loadMachines,
  matchImages,
  categorize,
  similarity,
  defaultDeposit,
} from './lib-catalogue.js';

const woo = loadWoo();
const tarif = loadTarif();
const machines = loadMachines();

console.log(`WooCommerce : ${woo.length} produits (${woo.filter((w) => w.isPack).length} packs)`);
console.log(`Tarif       : ${tarif.length} lignes`);
console.log(`Liste mach. : ${machines.length} lignes\n`);

let priced = 0;
let withImages = 0;
const unmatched: string[] = [];
const catCount: Record<string, number> = {};

for (const w of woo) {
  if (w.isPack) continue;

  // tarif
  let best = { row: null as (typeof tarif)[number] | null, score: 0 };
  for (const r of tarif) {
    const s = similarity(w.title, r.name);
    if (s > best.score) best = { row: r, score: s };
  }
  const price = best.score >= 0.34 ? best.row : null;
  if (price && price.dayHT > 0) priced++;
  else unmatched.push(`${w.title}  (best: ${best.row?.name ?? '—'} @ ${best.score.toFixed(2)})`);

  // marque
  let bm = { row: null as (typeof machines)[number] | null, score: 0 };
  for (const m of machines) {
    const s = similarity(w.title, `${m.type} ${m.model}`);
    if (s > bm.score) bm = { row: m, score: s };
  }
  const brand = bm.score >= 0.3 ? bm.row : null;

  // images
  const imgs = matchImages(w.slug, w.title);
  if (imgs.length) withImages++;

  const cat = categorize(w.title);
  catCount[cat] = (catCount[cat] ?? 0) + 1;

  const dep = price ? defaultDeposit(price.dayHT, price.garantie) : 0;
  console.log(
    `${w.slug.padEnd(38)} ${cat.padEnd(28)} ${
      price && price.dayHT ? `${price.dayHT}€/j`.padEnd(9) : '— prix —'.padEnd(9)
    } caution ${String(dep).padEnd(5)} ${brand?.brand ?? '?'} img:${imgs.length}`,
  );
}

console.log(`\n== Résumé ==`);
console.log(`Tarif trouvé : ${priced}/${woo.filter((w) => !w.isPack).length}`);
console.log(`Images       : ${withImages}/${woo.filter((w) => !w.isPack).length}`);
console.log(`Catégories   :`, catCount);
console.log(`\n== Sans tarif (${unmatched.length}) ==`);
unmatched.forEach((u) => console.log('  ' + u));
