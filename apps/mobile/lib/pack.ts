/**
 * Réordonne les lignes pour que les machines incluses dans un BricoPack (packRef)
 * suivent leur ligne pack parente.
 */
export function orderPackItems<
  T extends { id: string; productId: string; kind: string; packRef?: string | null },
>(items: T[]): T[] {
  const children = new Map<string, T[]>();
  for (const it of items) {
    if (it.packRef) {
      const list = children.get(it.packRef) ?? [];
      list.push(it);
      children.set(it.packRef, list);
    }
  }
  const out: T[] = [];
  for (const it of items) {
    if (it.packRef) continue;
    out.push(it);
    if (it.kind === 'PACK') out.push(...(children.get(it.productId) ?? []));
  }
  for (const it of items) {
    if (it.packRef && !out.includes(it)) out.push(it);
  }
  return out;
}
