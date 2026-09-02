/**
 * Sème des avis clients de démonstration sur le catalogue publié.
 * Idempotent (n'ajoute pas de doublon d'auteur par produit).
 *   npx tsx scripts/seed-reviews.ts
 */
import '../src/env.js';
import { prisma } from '../src/db.js';

const DEMO = [
  { name: 'Julien D.', rating: 5, title: 'Nickel', body: 'Machine propre, bien entretenue, prête à l’heure. Retrait au comptoir en 5 minutes.' },
  { name: 'Sophie M.', rating: 4, title: 'Bon rapport qualité/prix', body: 'Un peu d’attente un samedi matin, mais le matériel était parfait pour mon chantier.' },
  { name: 'Karim B.', rating: 5, title: 'Parfait pour un week-end', body: 'Pris le vendredi soir, rendu le lundi, facturé une journée. Exactement ce qu’il me fallait.' },
  { name: 'Nathalie V.', rating: 5, title: 'Équipe de bon conseil', body: 'On m’a orienté vers le bon modèle et les bons consommables. Résultat au top.' },
  { name: 'Marc L.', rating: 4, title: 'Fiable', body: 'Rien à redire, la caution a été libérée le jour même du retour.' },
  { name: 'Émilie R.', rating: 5, title: 'Je recommande', body: 'Réservation en ligne simple, matériel conforme à la description.' },
  { name: 'Thomas P.', rating: 4, title: 'Bien', body: 'Bon état général, quelques traces d’usage normales. Fonctionne parfaitement.' },
  { name: 'Céline G.', rating: 5, title: 'Rapide', body: 'Click & Collect efficace, le QR code au comptoir et c’est réglé.' },
];

async function main() {
  const products = await prisma.product.findMany({
    where: { published: true, kind: 'MACHINE' },
    select: { id: true },
    orderBy: { name: 'asc' },
  });
  let created = 0;
  let pi = 0;
  for (const p of products) {
    // ~2 produits sur 3 reçoivent des avis, le reste reste "sans avis" (réaliste)
    if (pi % 3 === 2) {
      pi++;
      continue;
    }
    const n = 2 + (pi % 3); // 2 à 4 avis
    for (let k = 0; k < n; k++) {
      const src = DEMO[(pi + k) % DEMO.length]!;
      const exists = await prisma.review.findFirst({
        where: { productId: p.id, authorName: src.name },
      });
      if (exists) continue;
      await prisma.review.create({
        data: {
          productId: p.id,
          authorName: src.name,
          rating: src.rating,
          title: src.title,
          body: src.body,
          status: 'PUBLISHED',
          publishedAt: new Date(Date.now() - (pi * 2 + k) * 86_400_000),
        },
      });
      created++;
    }
    pi++;
  }
  console.log(`${created} avis créés sur ${products.length} produits.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
