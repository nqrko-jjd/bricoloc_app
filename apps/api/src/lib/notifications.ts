import type { NotificationType } from '@bricoloc/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Cree une notification en base (visible espace client web + mobile) et
 * envoie un push Expo si des tokens sont enregistres.
 * En dev (EXPO_PUSH_ENABLED=false) le push est simplement logge.
 */
export async function notify(input: NotifyInput): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: (input.data ?? {}) as never,
    },
  });

  const tokens = await prisma.pushToken.findMany({ where: { userId: input.userId } });
  if (tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    sound: 'default',
    title: input.title,
    body: input.body,
    data: input.data ?? {},
  }));

  if (!env.expoPushEnabled) {
    // eslint-disable-next-line no-console
    console.log(`[push:simule] ${input.title} -> ${tokens.length} appareil(s)`);
    return;
  }
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[push] echec envoi Expo', e);
  }
}

export const NOTIF_TEMPLATES: Record<
  NotificationType,
  (ctx: { number: string }) => { title: string; body: string }
> = {
  RESERVATION_CONFIRMED: (c) => ({
    title: 'Réservation confirmée',
    body: `Votre réservation ${c.number} est confirmée. Votre QR code est disponible.`,
  }),
  EQUIPMENT_READY: (c) => ({
    title: 'Matériel prêt',
    body: `Le matériel de la réservation ${c.number} est prêt pour le retrait.`,
  }),
  PICKUP_REMINDER: (c) => ({
    title: 'Rappel de retrait',
    body: `N'oubliez pas de retirer le matériel de la réservation ${c.number}.`,
  }),
  DELIVERY_ON_THE_WAY: (c) => ({
    title: 'Livraison en cours',
    body: `Votre livraison pour la réservation ${c.number} est en route.`,
  }),
  RETURN_REMINDER: (c) => ({
    title: 'Rappel de retour',
    body: `Le retour du matériel de la réservation ${c.number} approche.`,
  }),
  DUE_SOON: (c) => ({
    title: 'Échéance proche',
    body: `La location ${c.number} arrive à échéance. Pensez à prolonger si besoin.`,
  }),
  RETURN_CONFIRMED: (c) => ({
    title: 'Retour confirmé',
    body: `Le retour de la réservation ${c.number} a bien été enregistré.`,
  }),
  DEPOSIT_RELEASED: (c) => ({
    title: 'Caution libérée',
    body: `La caution de la réservation ${c.number} a été libérée.`,
  }),
  GENERIC: () => ({ title: 'BRICOLOC', body: 'Mise à jour de votre dossier.' }),
};
