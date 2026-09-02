/**
 * Aligne le `provider` de prisma/schema.prisma sur le schéma d'URL de DATABASE_URL.
 *   - postgres:// | postgresql://  -> "postgresql"
 *   - file:  (défaut)              -> "sqlite"
 *
 * Permet de garder SQLite en dev (double-clic, zéro service) et PostgreSQL en
 * production, sans dupliquer le schéma. À lancer avant `prisma generate` / `db push`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'schema.prisma');
const url = process.env.DATABASE_URL ?? '';
const provider = /^postgres(ql)?:\/\//i.test(url) ? 'postgresql' : 'sqlite';

const src = readFileSync(schemaPath, 'utf8');
const next = src.replace(/(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"[^"]+"/s, `$1"${provider}"`);

if (next !== src) {
  writeFileSync(schemaPath, next);
  console.log(`[set-db-provider] provider = "${provider}"`);
} else {
  console.log(`[set-db-provider] provider déjà "${provider}"`);
}
