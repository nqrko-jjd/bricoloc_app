// Injecte les images (data-URI) dans maquettes.src.html -> maquettes.html
// Lancer depuis le dossier docs/ :  node build-maquettes.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('maquettes.src.html', 'utf8');
const img = readFileSync('discovery/img.json', 'utf8');
if (!src.includes('"__IMG_DATA__"')) throw new Error('marker manquant');
writeFileSync('maquettes.html', src.replace('"__IMG_DATA__"', img));
console.log('maquettes.html OK');
