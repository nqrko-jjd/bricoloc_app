/**
 * Traduit les clés manquantes de messages/fr.json vers messages/nl.json et
 * messages/en.json via DeepL. Idempotent : ne touche pas aux clés déjà présentes.
 *
 *   node scripts/translate-messages.mjs            # complète nl + en
 *   node scripts/translate-messages.mjs --force    # retraduit tout
 *
 * Lit la clé DeepL depuis DEEPL_API_KEY, sinon depuis ../../apps/api/.env.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const msgDir = path.join(here, '..', 'messages');
const force = process.argv.includes('--force');

let key = process.env.DEEPL_API_KEY;
if (!key) {
  const envPath = path.join(here, '..', '..', 'api', '.env');
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, 'utf8').match(/^\s*DEEPL_API_KEY\s*=\s*"?([^"\n]+)"?/m);
    if (m) key = m[1].trim();
  }
}
if (!key) {
  console.error('DEEPL_API_KEY introuvable.');
  process.exit(1);
}
const host = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';

const fr = JSON.parse(readFileSync(path.join(msgDir, 'fr.json'), 'utf8'));

/** aplatit { a: { b: "x" } } -> { "a.b": "x" } */
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}
function setDeep(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] ??= {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

async function deepl(texts, target) {
  // Protège les placeholders ICU {xxx} : DeepL les traduit parfois. On les
  // remplace par des jetons neutres, on traduit, puis on restaure dans l'ordre.
  const masks = texts.map((t) => {
    const found = t.match(/\{\w+\}/g) ?? [];
    let masked = t;
    found.forEach((ph, i) => {
      masked = masked.replace(ph, `[[${i}]]`);
    });
    return { masked, found };
  });

  const body = new URLSearchParams();
  body.set('source_lang', 'FR');
  body.set('target_lang', target);
  for (const m of masks) body.append('text', m.masked);

  const res = await fetch(`${host}/v2/translate`, {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.translations.map((tr, i) => {
    let out = tr.text;
    masks[i].found.forEach((ph, j) => {
      out = out.replace(new RegExp(`\\[\\[\\s*${j}\\s*\\]\\]`), ph);
    });
    return out;
  });
}

const flatFr = flatten(fr);

for (const [locale, deeplLang] of [
  ['nl', 'NL'],
  ['en', 'EN-GB'],
]) {
  const file = path.join(msgDir, `${locale}.json`);
  const target = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const flatTarget = flatten(target);

  const missing = Object.keys(flatFr).filter((k) => force || !flatTarget[k]);
  if (missing.length === 0) {
    console.log(`${locale}: à jour`);
    continue;
  }
  console.log(`${locale}: ${missing.length} clés à traduire…`);
  // DeepL accepte jusqu'à 50 textes / requête
  for (let i = 0; i < missing.length; i += 45) {
    const batch = missing.slice(i, i + 45);
    const out = await deepl(
      batch.map((k) => String(flatFr[k])),
      deeplLang,
    );
    batch.forEach((k, j) => setDeep(target, k, out[j]));
  }
  writeFileSync(file, JSON.stringify(target, null, 2) + '\n');
  console.log(`${locale}: écrit (${missing.length} clés)`);
}
