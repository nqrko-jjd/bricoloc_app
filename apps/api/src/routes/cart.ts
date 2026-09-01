import { Router } from 'express';
import {
  applyPromoSchema,
  cartFulfilmentSchema,
  cartItemSchema,
  setCartPeriodSchema,
} from '@bricoloc/shared';
import { prisma } from '../db.js';
import { badRequest, h, notFound } from '../lib/http.js';
import { attachPrincipal } from '../lib/auth.js';
import {
  cartKeyFrom,
  getOrCreateCart,
  newSessionKey,
  serializeCart,
} from '../lib/cart.js';

export const cartRouter = Router();
cartRouter.use(attachPrincipal);

const userId = (req: import('express').Request) =>
  req.principal?.kind === 'user' ? req.principal.id : undefined;

/** Cree une nouvelle cle de panier (appele une fois par le client). */
cartRouter.post(
  '/new',
  h(async (req, res) => {
    const key = newSessionKey();
    await getOrCreateCart(key, userId(req));
    res.status(201).json({ cartKey: key });
  }),
);

cartRouter.get(
  '/',
  h(async (req, res) => {
    const key = cartKeyFrom(req);
    res.json(await serializeCart(key, userId(req)));
  }),
);

cartRouter.post(
  '/items',
  h(async (req, res) => {
    const key = cartKeyFrom(req);
    const { productId, quantity } = cartItemSchema.parse(req.body);
    const cart = await getOrCreateCart(key, userId(req));
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.published) throw notFound('Produit introuvable');

    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      create: { cartId: cart.id, productId, quantity },
      update: { quantity: { increment: quantity } },
    });
    res.status(201).json(await serializeCart(key, userId(req)));
  }),
);

cartRouter.patch(
  '/items/:productId',
  h(async (req, res) => {
    const key = cartKeyFrom(req);
    const quantity = Number(req.body?.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) throw badRequest('Quantite invalide');
    const cart = await getOrCreateCart(key, userId(req));
    if (quantity === 0) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id, productId: req.params.productId },
      });
    } else {
      await prisma.cartItem.update({
        where: { cartId_productId: { cartId: cart.id, productId: req.params.productId } },
        data: { quantity },
      });
    }
    res.json(await serializeCart(key, userId(req)));
  }),
);

cartRouter.delete(
  '/items/:productId',
  h(async (req, res) => {
    const key = cartKeyFrom(req);
    const cart = await getOrCreateCart(key, userId(req));
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id, productId: req.params.productId },
    });
    res.json(await serializeCart(key, userId(req)));
  }),
);

/** Definit (ou efface) la periode GLOBALE du panier. */
cartRouter.put(
  '/period',
  h(async (req, res) => {
    const key = cartKeyFrom(req);
    const { period } = setCartPeriodSchema.parse(req.body);
    const cart = await getOrCreateCart(key, userId(req));
    await prisma.cart.update({
      where: { id: cart.id },
      data: {
        periodStart: period ? new Date(period.start) : null,
        periodEnd: period ? new Date(period.end) : null,
      },
    });
    res.json(await serializeCart(key, userId(req)));
  }),
);

cartRouter.put(
  '/fulfilment',
  h(async (req, res) => {
    const key = cartKeyFrom(req);
    const data = cartFulfilmentSchema.parse(req.body);
    const cart = await getOrCreateCart(key, userId(req));
    let address = data.address ?? null;
    if (data.addressId) {
      const a = await prisma.address.findUnique({ where: { id: data.addressId } });
      if (a)
        address = {
          label: a.label ?? undefined,
          line1: a.line1,
          line2: a.line2 ?? undefined,
          postalCode: a.postalCode,
          city: a.city,
          country: a.country,
          isConstructionSite: a.isConstructionSite,
          contactName: a.contactName ?? undefined,
          contactPhone: a.contactPhone ?? undefined,
        };
    }
    await prisma.cart.update({
      where: { id: cart.id },
      data: {
        fulfilmentMode: data.mode,
        address: address as never,
        slot: data.slot ?? null,
      },
    });
    res.json(await serializeCart(key, userId(req)));
  }),
);

cartRouter.post(
  '/promo',
  h(async (req, res) => {
    const key = cartKeyFrom(req);
    const { code } = applyPromoSchema.parse(req.body);
    const cart = await getOrCreateCart(key, userId(req));
    const promo = await prisma.promotion.findUnique({ where: { code: code.toUpperCase() } });
    if (!promo || !promo.active) throw badRequest('Code promo invalide');
    if (promo.expiresAt && promo.expiresAt.getTime() < Date.now())
      throw badRequest('Code promo expire');
    await prisma.cart.update({
      where: { id: cart.id },
      data: { promoCode: code.toUpperCase() },
    });
    res.json(await serializeCart(key, userId(req)));
  }),
);

cartRouter.delete(
  '/promo',
  h(async (req, res) => {
    const key = cartKeyFrom(req);
    const cart = await getOrCreateCart(key, userId(req));
    await prisma.cart.update({ where: { id: cart.id }, data: { promoCode: null } });
    res.json(await serializeCart(key, userId(req)));
  }),
);
