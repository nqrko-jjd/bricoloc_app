import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';

export type TicketKind = 'PROBLEM' | 'EXTENSION' | 'QUESTION';
export type AuthorType = 'CLIENT' | 'STAFF' | 'SYSTEM';

export async function createTicket(input: {
  userId: string | null;
  reservationId: string | null;
  subject: string;
  message: string;
  kind: TicketKind;
  authorName?: string | null;
}) {
  return prisma.supportTicket.create({
    data: {
      userId: input.userId,
      reservationId: input.reservationId,
      subject: input.subject,
      message: input.message,
      kind: input.kind,
      clientUnread: false,
      staffUnread: true,
      messages: {
        create: { authorType: 'CLIENT', authorName: input.authorName ?? null, body: input.message },
      },
    },
  });
}

/** Ajoute un message au fil et met à jour l'état (non-lus, statut, tri par dernière activité). */
export async function postMessage(
  ticketId: string,
  author: { type: AuthorType; name?: string | null },
  body: string,
) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error('Ticket introuvable');

  const data: Prisma.SupportTicketUpdateInput = { lastMessageAt: new Date() };
  if (author.type === 'CLIENT') {
    data.staffUnread = true;
    data.clientUnread = false;
    // Un client qui écrit sur un ticket clôturé le rouvre.
    if (ticket.status === 'CLOSED') data.status = 'OPEN';
  } else if (author.type === 'STAFF') {
    data.clientUnread = true;
    data.staffUnread = false;
    if (ticket.status === 'OPEN') data.status = 'IN_PROGRESS';
  }

  const [message] = await prisma.$transaction([
    prisma.ticketMessage.create({
      data: { ticketId, authorType: author.type, authorName: author.name ?? null, body },
    }),
    prisma.supportTicket.update({ where: { id: ticketId }, data }),
  ]);
  return message;
}

interface LegacyTicket {
  id: string;
  message: string;
  response: string | null;
  createdAt: Date;
  messages: { id: string; authorType: string; authorName: string | null; body: string; createdAt: Date }[];
}

/** Fil ordonné. Les anciens tickets (avant le fil) sont reconstitués : message + réponse unique. */
export function threadOf(t: LegacyTicket) {
  if (t.messages.length > 0) return t.messages;
  const legacy = [
    { id: `${t.id}-q`, authorType: 'CLIENT', authorName: null, body: t.message, createdAt: t.createdAt },
  ];
  if (t.response) {
    legacy.push({ id: `${t.id}-a`, authorType: 'STAFF', authorName: null, body: t.response, createdAt: t.createdAt });
  }
  return legacy;
}

export const ticketListSelect = {
  id: true,
  subject: true,
  status: true,
  kind: true,
  message: true,
  createdAt: true,
  lastMessageAt: true,
  clientUnread: true,
  staffUnread: true,
  reservation: { select: { id: true, number: true } },
  user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  messages: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { body: true, authorType: true } },
} satisfies Prisma.SupportTicketSelect;
