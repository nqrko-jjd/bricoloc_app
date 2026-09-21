import { computeRentalPrice, formatDateTimeBE, formatEUR } from '@bricoloc/shared';
import { prisma } from '../db.js';
import { badRequest, conflict, notFound } from './http.js';
import { availabilityFor } from './availability.js';
import { getSettings, pricingSettings } from './settings.js';
import { recomputeReservation } from './quote.js';
import { notify } from './notifications.js';
import { postMessage } from './tickets.js';

/** Statuts pour lesquels une prolongation a du sens (matériel réservé, prêt ou sorti). */
export const EXTENDABLE_STATUSES = ['CONFIRMED', 'READY', 'OUT', 'RETURN_PENDING'];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Chiffre le supplément et vérifie la disponibilité de chaque ligne sur la période ajoutée. */
export async function quoteExtension(reservationId: string, end: Date) {
  const r = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { items: { include: { product: true } } },
  });
  if (!r) throw notFound();
  if (end.getTime() <= r.periodEnd.getTime())
    throw badRequest('La nouvelle date doit être postérieure à la date de retour actuelle');

  const settings = await getSettings();
  const ps = pricingSettings(settings);
  const conflicts = [];
  let extraHT = 0;
  for (const item of r.items) {
    if (item.product.isConsumable) continue;
    const avail = await availabilityFor(item.productId, r.periodEnd, end, item.quantity, {
      excludeReservationId: r.id,
    });
    if (avail.status !== 'AVAILABLE') conflicts.push(avail);
    // Machine incluse dans un pack : dispo vérifiée, mais son prix est porté par la ligne du pack.
    if (item.packRef) continue;
    const pricing = {
      dailyPrice: item.product.dailyPrice,
      weekendPrice: item.product.weekendPrice,
      weekPrice: item.product.weekPrice,
      monthPrice: item.product.monthPrice,
      tiers: (item.product.tiers as never) ?? [],
      deposit: item.product.deposit,
    };
    const base = {
      pricing,
      quantity: item.quantity,
      customerType: 'PARTICULIER' as const,
      settings: ps,
    };
    const before = computeRentalPrice({ ...base, period: { start: r.periodStart, end: r.periodEnd } });
    const after = computeRentalPrice({ ...base, period: { start: r.periodStart, end } });
    extraHT += after.linePrice - before.linePrice;
  }
  const vat = Number(settings.vatRate ?? 0.21);
  return {
    reservation: r,
    conflicts,
    extraHT: round2(extraHT),
    extraTVAC: round2(extraHT * (1 + vat)),
  };
}

const staffLabel = async (staffId: string) => {
  const s = await prisma.staffUser.findUnique({ where: { id: staffId } });
  return s?.name ?? 'Équipe BRICOLOC';
};

/** L'équipe accepte : la MÊME réservation est prolongée (dates + prix recalculés), le client est prévenu. */
export async function approveExtension(extensionId: string, staffId: string) {
  const ext = await prisma.reservationExtension.findUnique({
    where: { id: extensionId },
    include: { reservation: true },
  });
  if (!ext) throw notFound('Demande introuvable');
  if (ext.status !== 'PENDING') throw badRequest('Cette demande a déjà été traitée');
  if (!EXTENDABLE_STATUSES.includes(ext.reservation.status))
    throw badRequest('Cette réservation ne peut plus être prolongée');

  const q = await quoteExtension(ext.reservationId, ext.requestedEnd);
  if (q.conflicts.length > 0) {
    throw conflict('Matériel déjà réservé sur la période demandée : impossible d’accepter.', q.conflicts);
  }

  // Réserve la décision de façon atomique : deux membres de l'équipe qui cliquent en même temps
  // ne prolongent pas deux fois.
  const who = await staffLabel(staffId);
  const claimed = await prisma.reservationExtension.updateMany({
    where: { id: ext.id, status: 'PENDING' },
    data: { status: 'APPROVED', pendingKey: null, decidedAt: new Date(), decidedBy: who, extraHT: q.extraHT, extraTVAC: q.extraTVAC },
  });
  if (claimed.count === 0) throw badRequest('Cette demande a déjà été traitée');

  await prisma.reservation.update({
    where: { id: ext.reservationId },
    data: { periodEnd: ext.requestedEnd },
  });
  await recomputeReservation(ext.reservationId);

  const when = formatDateTimeBE(ext.requestedEnd);
  if (ext.ticketId) {
    await postMessage(
      ext.ticketId,
      { type: 'STAFF', name: who },
      `Prolongation acceptée : votre nouvelle date de retour est le ${when}. Supplément estimé : ${formatEUR(q.extraTVAC)} TVAC, réglé au retour du matériel.`,
    );
    await prisma.supportTicket.update({ where: { id: ext.ticketId }, data: { status: 'CLOSED' } });
  }
  if (ext.reservation.userId) {
    await notify({
      userId: ext.reservation.userId,
      type: 'GENERIC',
      title: 'Prolongation acceptée',
      body: `Location ${ext.reservation.number} : nouveau retour le ${when}.`,
      data: { reservationId: ext.reservationId, ticketId: ext.ticketId },
    });
  }
  return prisma.reservationExtension.findUnique({ where: { id: ext.id } });
}

export async function rejectExtension(extensionId: string, staffId: string, reason?: string) {
  const ext = await prisma.reservationExtension.findUnique({
    where: { id: extensionId },
    include: { reservation: true },
  });
  if (!ext) throw notFound('Demande introuvable');
  if (ext.status !== 'PENDING') throw badRequest('Cette demande a déjà été traitée');

  const who = await staffLabel(staffId);
  await prisma.reservationExtension.update({
    where: { id: ext.id },
    data: { status: 'REJECTED', pendingKey: null, decidedAt: new Date(), decidedBy: who },
  });
  const text = `Prolongation refusée : la date de retour reste le ${formatDateTimeBE(ext.reservation.periodEnd)}.${
    reason ? ` ${reason}` : ''
  }`;
  if (ext.ticketId) {
    await postMessage(ext.ticketId, { type: 'STAFF', name: who }, text);
    await prisma.supportTicket.update({ where: { id: ext.ticketId }, data: { status: 'CLOSED' } });
  }
  if (ext.reservation.userId) {
    await notify({
      userId: ext.reservation.userId,
      type: 'GENERIC',
      title: 'Prolongation refusée',
      body: `Location ${ext.reservation.number} : ${text}`,
      data: { reservationId: ext.reservationId, ticketId: ext.ticketId },
    });
  }
  return prisma.reservationExtension.findUnique({ where: { id: ext.id } });
}
