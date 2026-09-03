/**
 * Transfert de base : SQLite (dev) -> PostgreSQL (prod).
 *
 *   # sur le PC (base locale) :
 *   npx tsx scripts/db-transfer.ts --export ../../db-export.json
 *
 *   # sur le serveur (dans le conteneur api, DATABASE_URL = postgres) :
 *   npx tsx scripts/db-transfer.ts --import /tmp/db-export.json
 *
 * L'export lit tous les modèles via Prisma (types propres : Date, JSON, bool).
 * L'import désactive les triggers FK le temps du chargement (ordre indifférent),
 * insère en `createMany({ skipDuplicates })` par lots. Idempotent.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { PrismaClient, Prisma } from '@prisma/client';

// Charge apps/api/.env si présent (export en local) ; en prod le conteneur
// fournit déjà DATABASE_URL via l'environnement.
try {
  const { readFileSync: rf, existsSync } = await import('node:fs');
  const p = new URL('../.env', import.meta.url);
  if (existsSync(p)) {
    for (const line of rf(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && m[1] && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  }
} catch {
  /* ignore */
}

const prisma = new PrismaClient();
const mode = process.argv[2];
const file = process.argv[3];

const models = Prisma.dmmf.datamodel.models;
const delegateName = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);
const chunk = <T>(arr: T[], n: number) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function doExport() {
  const out: Record<string, unknown[]> = {};
  for (const m of models) {
    const rows = await (prisma as any)[delegateName(m.name)].findMany();
    out[m.name] = rows;
    console.log(`  ${m.name}: ${rows.length}`);
  }
  writeFileSync(file, JSON.stringify(out));
  console.log(`\nExport écrit : ${file} (${(JSON.stringify(out).length / 1024 / 1024).toFixed(1)} Mo)`);
}

async function doImport() {
  const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, any[]>;
  const wipe = process.argv.includes('--wipe');
  await prisma.$executeRawUnsafe(`SET session_replication_role = replica`);
  try {
    if (wipe) {
      const tables = models.map((m) => `"${m.dbName ?? m.name}"`).join(', ');
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
      console.log('Base vidée.');
    }
    let total = 0;
    for (const m of models) {
      const rows = data[m.name] ?? [];
      if (!rows.length) continue;
      const dateFields = m.fields.filter((f) => f.type === 'DateTime').map((f) => f.name);
      const clean = rows.map((r) => {
        const o: Record<string, unknown> = { ...r };
        for (const f of dateFields) if (o[f] != null) o[f] = new Date(o[f] as string);
        return o;
      });
      let n = 0;
      for (const part of chunk(clean, 400)) {
        const res = await (prisma as any)[delegateName(m.name)].createMany({
          data: part,
          skipDuplicates: true,
        });
        n += res.count;
      }
      total += n;
      console.log(`  ${m.name}: ${n}/${rows.length}`);
    }
    console.log(`\nImport terminé : ${total} lignes.`);
  } finally {
    await prisma.$executeRawUnsafe(`SET session_replication_role = DEFAULT`);
  }
}

(async () => {
  if (mode === '--export' && file) await doExport();
  else if (mode === '--import' && file) await doImport();
  else {
    console.error('Usage : db-transfer.ts --export <file> | --import <file>');
    process.exit(1);
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
