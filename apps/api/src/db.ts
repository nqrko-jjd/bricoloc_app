import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/** Increment atomique d'un compteur nomme (numeros de reservation / factures). */
export async function nextCounter(name: string): Promise<number> {
  const row = await prisma.counter.upsert({
    where: { name },
    create: { name, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}
