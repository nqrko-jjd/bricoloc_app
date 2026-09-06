/** Un BricoPack (kind PACK) a sa propre page de présentation, pas la fiche produit. */
export function productHref(p: { slug: string; kind?: string }): string {
  return p.kind === 'PACK' ? `/bricopacks/${p.slug}` : `/produits/${p.slug}`;
}
