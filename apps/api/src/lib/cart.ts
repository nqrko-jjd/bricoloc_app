import type { Request } from 'express';
import { customAlphabet } from 'nanoid';
import { prisma } from '../db.js';
import { badRequest } from './http.js';
import { buildQuote } from './quote.js';
import { recommendationsFor } from './recommendations.js';
import { availabilityFor } from './availability.js';
import type { CustomerType } from '@bricoloc/shared';

const genKey = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 24);

export function newSessionKey(): string {
  return genKey();
}

export function cartKeyFrom(req: Request): string {
  const key =
    (req.headers['x-cart-key'] as string | undefined) ||
    (req.query.cartKey as string | undefined) ||
    (req.body?.cartKey as string | undefined);
  if (!key) throw badRequest('Cle de panier (x-cart-key) manquante');
  return key;
}

export async function getOrCreateCart(sessionKey: string, userId?: string) {
  let cart = await prisma.cart.findUnique({
    where: { sessionKey },
    include: { items: { include: { product: true } } },
  });
  if (!cart) {
    cart = await prisma.cart.create({
      data: { sessionKey, userId: userId ?? null },
      include: { items: { include: { product: true } } },
    });
  } else if (userId && cart.userId !== userId) {
    cart = await prisma.cart.update({
      where: { id: cart.id },
      data: { userId },
      include: { items: { include: { product: true } } },
    });
  }
  return cart;
}

export async function customerTypeFor(userId?: string): Promise<CustomerType> {
  if (!userId) return 'PARTICULIER';
  const u = await prisma.user.findUnique({ where: { id: userId } });
  return (u?.customerType as CustomerType) ?? 'PARTICULIER';
}

/** Vue complete du panier : lignes, periode, devis, dispo par ligne, recommandations, alertes. */
export async function serializeCart(sessionKey: string, userId?: string) {
  const cart = await getOrCreateCart(sessionKey, userId);
  const period =
    cart.periodStart && cart.periodEnd
      ? { start: cart.periodStart, end: cart.periodEnd }
      : null;
  const customerType = await customerTypeFor(cart.userId ?? userId);

  const itemsOut = [];
  const availabilityAlerts = [];
  for (const item of cart.items) {
    let availability = null;
    if (period) {
      availability = await availabilityFor(
        item.productId,
        period.start,
        period.end,
        item.quantity,
        { withAlternatives: true },
      );
      if (availability.status !== 'AVAILABLE') {
        availabilityAlerts.push(availability);
      }
    }
    itemsOut.push({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      name: item.product.name,
      slug: item.product.slug,
      kind: item.product.kind,
      image: (item.product.images as string[])?.[0] ?? null,
      dailyPrice: item.product.dailyPrice,
      deposit: item.product.deposit,
      isConsumable: item.product.isConsumable,
      availability,
    });
  }

  let quote = null;
  if (period && cart.items.length > 0) {
    quote = await buildQuote({
      lines: cart.items.map((i) => ({ product: i.product, quantity: i.quantity })),
      periodStart: period.start,
      periodEnd: period.end,
      customerType,
      fulfilmentMode: (cart.fulfilmentMode as 'PICKUP' | 'DELIVERY') ?? 'PICKUP',
      deliveryAddressPostalCode:
        (cart.address as { postalCode?: string } | null)?.postalCode ?? null,
      promoCode: cart.promoCode,
    });
  }

  const recommendations = await recommendationsFor(
    cart.items.map((i) => i.productId),
  );

  return {
    cartKey: cart.sessionKey,
    userId: cart.userId,
    period: period
      ? { start: period.start.toISOString(), end: period.end.toISOString() }
      : null,
    fulfilmentMode: cart.fulfilmentMode,
    address: cart.address,
    slot: cart.slot,
    promoCode: cart.promoCode,
    itemCount: cart.items.reduce((a, i) => a + i.quantity, 0),
    items: itemsOut,
    availabilityAlerts,
    hasBlockingIssue: availabilityAlerts.some(
      (a) => a.status === 'UNAVAILABLE' || a.status === 'NEARBY',
    ),
    quote,
    recommendations,
  };
}
