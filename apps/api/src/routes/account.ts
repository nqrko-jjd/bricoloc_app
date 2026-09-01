import { Router } from 'express';
import { addressSchema, registerPushTokenSchema } from '@bricoloc/shared';
import { prisma } from '../db.js';
import { forbidden, h, notFound } from '../lib/http.js';
import { attachPrincipal, requireUser } from '../lib/auth.js';

export const accountRouter = Router();
accountRouter.use(attachPrincipal, requireUser);

const uid = (req: import('express').Request) => req.principal!.id;

accountRouter.get(
  '/profile',
  h(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: uid(req) },
      include: { addresses: true },
    });
    if (!user) throw notFound();
    const { passwordHash, ...safe } = user;
    void passwordHash;
    res.json({ user: safe });
  }),
);

accountRouter.patch(
  '/profile',
  h(async (req, res) => {
    const allowed = ['firstName', 'lastName', 'phone', 'companyName', 'vatNumber'] as const;
    const data: Record<string, unknown> = {};
    for (const k of allowed) if (k in req.body) data[k] = req.body[k];
    const user = await prisma.user.update({ where: { id: uid(req) }, data });
    const { passwordHash, ...safe } = user;
    void passwordHash;
    res.json({ user: safe });
  }),
);

accountRouter.get(
  '/addresses',
  h(async (req, res) => {
    res.json({
      addresses: await prisma.address.findMany({ where: { userId: uid(req) } }),
    });
  }),
);

accountRouter.post(
  '/addresses',
  h(async (req, res) => {
    const data = addressSchema.parse(req.body);
    const address = await prisma.address.create({ data: { ...data, userId: uid(req) } });
    res.status(201).json({ address });
  }),
);

accountRouter.delete(
  '/addresses/:id',
  h(async (req, res) => {
    const a = await prisma.address.findUnique({ where: { id: req.params.id } });
    if (!a) throw notFound();
    if (a.userId !== uid(req)) throw forbidden();
    await prisma.address.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);

accountRouter.get(
  '/notifications',
  h(async (req, res) => {
    const rows = await prisma.notification.findMany({
      where: { userId: uid(req) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({
      notifications: rows,
      unread: rows.filter((n) => !n.readAt).length,
    });
  }),
);

accountRouter.post(
  '/notifications/read',
  h(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: uid(req), readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

accountRouter.post(
  '/push-tokens',
  h(async (req, res) => {
    const data = registerPushTokenSchema.parse(req.body);
    await prisma.pushToken.upsert({
      where: { token: data.token },
      create: { token: data.token, platform: data.platform, userId: uid(req) },
      update: { userId: uid(req), platform: data.platform },
    });
    res.status(201).json({ ok: true });
  }),
);

accountRouter.get(
  '/tickets',
  h(async (req, res) => {
    res.json({
      tickets: await prisma.supportTicket.findMany({
        where: { userId: uid(req) },
        orderBy: { createdAt: 'desc' },
      }),
    });
  }),
);
