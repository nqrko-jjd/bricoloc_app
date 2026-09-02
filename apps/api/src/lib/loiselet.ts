/**
 * Demande de location au partenaire Loiselet.
 *
 * Loiselet complète le parc Bricoloc sur les grosses machines / la clientèle pro.
 * La disponibilité n'est pas instantanée mais confirmée sous ~1 h : on envoie une
 * demande structurée par e-mail aux destinataires configurés en admin
 * (`settings.loiselet.recipients`), la réservation reste en `PENDING_SUPPLIER`
 * jusqu'à confirmation.
 *
 * Tant que le SMTP transactionnel n'est pas en place (Lot 7), l'API renvoie le
 * corps du message + un lien `mailto:` que l'équipe ouvre dans sa messagerie.
 */
import type { Prisma } from '@prisma/client';
import { formatEUR } from '@bricoloc/shared';
import type { AppSettings } from './settings.js';

type ReservationForRequest = Prisma.ReservationGetPayload<{
  include: { user: true; items: { include: { product: true } } };
}>;

export interface LoiseletRequest {
  recipients: string[];
  cc: string[];
  subject: string;
  body: string;
  /** Lien mailto prêt à l'emploi (destinataires + objet + corps encodés). */
  mailto: string;
  /** Nombre de lignes concernées par le partenaire. */
  itemCount: number;
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('fr-BE', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Brussels',
  }).format(d);
}

export function buildLoiseletRequest(
  r: ReservationForRequest,
  settings: AppSettings,
): LoiseletRequest {
  const cfg = (settings.loiselet ?? {}) as unknown as {
    recipients?: string[];
    ccBricoloc?: string;
    marginPct?: number;
  };
  const recipients = [...(cfg.recipients ?? [])].filter(Boolean);
  const cc = (cfg.ccBricoloc ?? '').split(/[,;\s]+/).filter(Boolean);

  const loiseletItems = r.items.filter((i) => i.product.supplier === 'LOISELET');
  const client = r.user
    ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || r.user.email
    : ((r.contact as { name?: string } | null)?.name ?? 'Client Bricoloc');

  const addr = r.address as { line1?: string; postalCode?: string; city?: string } | null;
  const deliveryLine =
    r.fulfilmentMode === 'DELIVERY' && addr
      ? `Livraison chantier : ${[addr.line1, addr.postalCode, addr.city].filter(Boolean).join(', ')}`
      : 'Enlèvement / à préciser';

  const lines = loiseletItems
    .map((i) => {
      const ref = i.product.supplierRef ? ` (réf. Loiselet ${i.product.supplierRef})` : '';
      const price = i.product.supplierListPrice
        ? ` — prix affiché ${formatEUR(i.product.supplierListPrice)}/jour`
        : '';
      return `  • ${i.quantity} × ${i.nameSnapshot}${ref}${price}`;
    })
    .join('\n');

  const subject = `Demande de location Bricoloc ${r.number} — ${fmtDate(r.periodStart)}`;
  const body = [
    'Bonjour,',
    '',
    `Nous souhaitons réserver le matériel suivant via notre partenariat :`,
    '',
    lines,
    '',
    `Période : du ${fmtDate(r.periodStart)} au ${fmtDate(r.periodEnd)}`,
    deliveryLine,
    `Client final : ${client}`,
    `Référence Bricoloc : ${r.number}`,
    '',
    'Merci de nous confirmer la disponibilité et le montant.',
    '',
    'Bien à vous,',
    "L'équipe Bricoloc",
  ].join('\n');

  const mailto =
    `mailto:${encodeURIComponent(recipients.join(','))}` +
    `?subject=${encodeURIComponent(subject)}` +
    (cc.length ? `&cc=${encodeURIComponent(cc.join(','))}` : '') +
    `&body=${encodeURIComponent(body)}`;

  return { recipients, cc, subject, body, mailto, itemCount: loiseletItems.length };
}
