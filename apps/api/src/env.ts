import { existsSync, copyFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const envPath = path.join(root, '.env');
if (!existsSync(envPath) && existsSync(path.join(root, '.env.example'))) {
  copyFileSync(path.join(root, '.env.example'), envPath);
}

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] && process.env[m[1]] === undefined) {
      let v = (m[2] ?? '').trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  }
}

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-bricoloc-secret-change-me',
  port: Number(process.env.PORT ?? 4000),
  publicApiUrl:
    process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,
  corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()),
  expoPushEnabled: process.env.EXPO_PUSH_ENABLED === 'true',
};
