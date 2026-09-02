/**
 * Pousse les pages de contenu enrichies (markdown) dans la base sans reset,
 * puis (re)traduit NL/EN via DeepL.
 *   npx tsx scripts/push-content-pages.ts
 */
import '../src/env.js';
import { prisma } from '../src/db.js';
import { translationEnabled } from '../src/lib/translate.js';
import { syncContentTranslations } from '../src/lib/i18n-content.js';

const PAGES: { key: string; title: string; body: string }[] = [
  {
    key: 'how-it-works',
    title: 'Comment ça marche',
    body: [
      'Louer chez BRICOLOC, c’est cinq minutes en ligne et un passage au comptoir.',
      '',
      '1. **Choisissez vos dates** une seule fois, pour tout le matériel de la commande.',
      '2. **Ajoutez vos machines, accessoires et consommables** au panier.',
      '3. Choisissez le **retrait en Click & Collect** au dépôt ou la **livraison sur chantier**.',
      '4. **Réservez et payez en ligne.** Une empreinte de caution est prise, jamais débitée si tout est rendu en ordre.',
      '5. Au retrait, **présentez votre QR code** au comptoir : le matériel est déjà préparé.',
      '6. **Rapportez le matériel** nettoyé et complet. La caution est libérée sous 48 h.',
      '',
      '## Une seule date pour toute la commande',
      'Pas besoin de réserver machine par machine : vous indiquez une période et on vérifie la disponibilité de tout le matériel en même temps.',
    ].join('\n'),
  },
  {
    key: 'click-collect',
    title: 'Click & Collect',
    body: [
      'Réservez en ligne, votre matériel vous attend au comptoir.',
      '',
      '- Commande validée avant 15 h : souvent **prête en 2 heures** selon la disponibilité.',
      '- Vous recevez un **e-mail de confirmation** dès que la commande est préparée.',
      '- Au comptoir, **présentez le QR code** de votre réservation. Une pièce d’identité est demandée pour le retrait.',
      '- Retrait au dépôt : **Gieterijstraat 49, 1601 Ruisbroek**, du lundi au samedi.',
      '',
      '## Et au retour ?',
      'Rapportez le matériel nettoyé et complet aux horaires d’ouverture. Le contrôle se fait avec vous ; la caution est libérée juste après.',
    ].join('\n'),
  },
  {
    key: 'delivery',
    title: 'Livraison',
    body: [
      'On livre le matériel directement sur votre chantier ou à votre domicile.',
      '',
      '## Zone desservie',
      'Bruxelles, Brabant wallon et Brabant flamand. Au-delà, contactez-nous pour un devis.',
      '',
      '## Frais et créneaux',
      '- Frais calculés selon la **distance depuis le dépôt** et affichés avant le paiement.',
      '- Livraison possible **dès le lendemain** pour toute commande validée avant 15 h.',
      '- Un créneau de passage vous est communiqué la veille.',
      '',
      '## Reprise',
      'L’enlèvement du matériel est organisé à la fin de la location, au même endroit. Vous n’avez rien à ramener.',
    ].join('\n'),
  },
  {
    key: 'pro',
    title: 'BRICOLOC Pro',
    body: [
      'Le compte Pro est fait pour les artisans, entreprises et indépendants qui louent régulièrement.',
      '',
      '## Ce que ça change',
      '- **Tarifs dégressifs** et remises négociées selon vos volumes.',
      '- **Facturation mensuelle** groupée, TVA récupérable (21 %).',
      '- **Devis rapides** pour vos appels d’offres.',
      '- Un interlocuteur dédié pour les grosses commandes.',
      '',
      '## Ouvrir un compte',
      'Créez un compte, ajoutez votre **numéro de TVA** et votre adresse de facturation. La validation prend un jour ouvrable.',
      '',
      '[Créer mon compte Pro](/inscription)',
    ].join('\n'),
  },
  {
    key: 'faq',
    title: 'Questions fréquentes',
    body: [
      '## Réservation & paiement',
      '### Quand suis-je débité ?',
      'La location est payée en ligne à la réservation. La caution est une simple empreinte : elle n’est jamais débitée si le matériel est rendu en ordre.',
      '### Puis-je annuler ?',
      'Oui, gratuitement jusqu’à 24 h avant le retrait.',
      '',
      '## Au comptoir',
      '### Que dois-je apporter ?',
      'Le QR code de votre réservation et une pièce d’identité.',
      '### Le matériel est-il prêt ?',
      'Oui : il est préparé, contrôlé et entretenu avant votre passage.',
      '',
      '## Retour',
      '### Et si je rends en retard ?',
      'Chaque jour de retard est facturé au tarif journalier, majoré.',
      '### Dois-je nettoyer le matériel ?',
      'Oui, rendez-le nettoyé et complet. Un forfait de nettoyage s’applique sinon.',
    ].join('\n'),
  },
];

async function main() {
  for (const p of PAGES) {
    await prisma.content.upsert({
      where: { key_locale: { key: p.key, locale: 'fr' } },
      create: { key: p.key, locale: 'fr', title: p.title, body: p.body, format: 'markdown', autoTranslated: false },
      update: { title: p.title, body: p.body, format: 'markdown', autoTranslated: false },
    });
    let translated: string[] = [];
    if (translationEnabled()) {
      translated = await syncContentTranslations(
        { key: p.key, title: p.title, body: p.body, format: 'markdown' },
        { force: true },
      );
    }
    console.log(`✓ ${p.key}${translated.length ? ` → ${translated.join(', ')}` : ' (FR only, DeepL absent)'}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
