import os from 'node:os';
import { createApp } from './app.js';
import { env } from './env.js';

function lanAddresses(): string[] {
  const out: string[] = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces ?? []) {
      if (i.family === 'IPv4' && !i.internal) out.push(i.address);
    }
  }
  return out;
}

const app = createApp();
// 0.0.0.0 : accessible depuis les autres appareils du reseau local (telephone + Expo Go).
app.listen(env.port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`BRICOLOC API`);
  console.log(`  local   : http://localhost:${env.port}  (health: /health)`);
  for (const ip of lanAddresses()) {
    // eslint-disable-next-line no-console
    console.log(`  reseau  : http://${ip}:${env.port}   <- a utiliser sur le telephone`);
  }
});
