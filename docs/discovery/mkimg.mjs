import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
const SRC = 'C:/Users/david/Downloads/Bricoloc/';

const jobs = [
  // hero + parallax angles
  ['hero', 'Image site/pexels-los-muertos-crew-8447774.jpg', 1600, 72],
  ['hero2', 'Image site/pexels-ksenia-chernaya-5691518.jpg', 1400, 70],
  ['hero3', 'Image site/professional-master-man-laying-ceramic-tiles-wall-bathroom-portrait-experienced-repairman-laying-large-size-porcelain-tilesconstruction-worker-checking-tile-installation-with-laser-level.jpg', 1400, 70],
  // seamless texture (tileable) — keep small
  ['tex', 'Texture-pattern/outils-pour-reparation-maison-motif-sans-couture/113.jpg', 520, 60],
  ['paint', 'Texture-pattern/old-painted-textured-surface-backdrop.jpg', 1200, 55],
  // ambiance / category
  ['amb_demo', 'Image site/pexels-ksenia-chernaya-5691544.jpg', 1000, 66],
  ['amb_paint', 'Image site/pexels-tima-miroshnichenko-6474471.jpg', 1000, 66],
  ['amb_tile', 'Image site/pose-carrelage_1000x667.webp', 1000, 66],
  ['amb_clean', 'Image site/pexels-skitterphoto-1388944.jpg', 1000, 66],
  ['amb_wood', 'Image site/pexels-antoni-shkraba-4981796.jpg', 1000, 66],
  ['amb_garden', 'Image site/roselyn-tirado-GDWmu0bFfS4-unsplash.jpg', 1000, 66],
  ['amb_elec', 'Image site/pexels-blue-bird-7218008.jpg', 1000, 66],
  ['amb_couple', 'Image site/pexels-ivan-samkov-5799013.jpg', 1100, 68],
  // products (with multiple angles for the fiche)
  ['p_marteau', 'marteau-piqueur-12-kg-20-j-1.webp', 900, 74],
  ['p_marteau_b', 'marteau-piqueur-12-kg-20-j-3.webp', 900, 74],
  ['p_marteau_c', 'marteau-piqueur-12-kg-20-j-2.webp', 900, 74],
  ['p_marteau_d', 'marteau-piqueur-12-kg-20-j-4.webp', 900, 74],
  ['p_disqueuse', 'disqueuse-230-mm-1.webp', 700, 74],
  ['p_disqueuse_b', 'disqueuse-230-mm-2.webp', 700, 74],
  ['p_decapeur', 'decapeur-thermique-1.webp', 700, 74],
  ['p_echafaud', 'echaffaudage-roulant-etroit-10-m-1.webp', 700, 74],
  ['p_groupe', 'groupe-electrogene-6-kva.webp', 700, 74],
  ['p_malaxeur', 'malaxeur-de-mortier-1.webp', 700, 74],
  ['p_perfo', 'MARTEAU-PERFORATEUR.webp', 700, 74],
  ['p_harnais', 'Harnais-de-sécurité-1.webp', 700, 74],
  // bricopacks
  ['pack_mur', 'bricopack-percement-mur-dur.jpg', 800, 70],
  ['pack_enduit', 'bricopack-enduisage-mur.jpg', 800, 70],
  ['pack_creux', 'bricopack-percement-mur-creux.jpg', 800, 70],
  ['pack_carrelage', 'Image site/pack_carrelage_xl.webp', 800, 70],
];

const out = {}; let total = 0;
for (const [key, file, width, q] of jobs) {
  try {
    const buf = await sharp(readFileSync(SRC + file)).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality: q, mozjpeg: true }).toBuffer();
    out[key] = `data:image/jpeg;base64,${buf.toString('base64')}`;
    total += buf.length;
    console.log(key.padEnd(16), (buf.length / 1024).toFixed(1), 'KB');
  } catch (e) { console.log(key.padEnd(16), 'ERR', e.message); }
}
console.log('TOTAL', (total / 1024).toFixed(0), 'KB  base64 ~', ((total * 1.34) / 1024).toFixed(0), 'KB');
writeFileSync('C:/Users/david/Documents/Bricoloc App/docs/discovery/img.json', JSON.stringify(out));
console.log('wrote img.json (', Object.keys(out).length, 'images )');
