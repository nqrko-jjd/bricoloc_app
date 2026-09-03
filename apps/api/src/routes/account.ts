import { Router } from 'express';
import multer from 'multer';
import { addressSchema, registerPushTokenSchema } from '@bricoloc/shared';
import { prisma } from '../db.js';
import { badRequest, forbidden, h, notFound } from '../lib/http.js';
import { attachPrincipal, requireUser } from '../lib/auth.js';
import { storeIdDocument, readPrivateFile, deletePrivateFile } from '../lib/media.js';

export const accountRouter = Router();
accountRouter.use(attachPrincipal, requireUser);

const uid = (req: import('express').Request) => req.principal!.id;

const idUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
});

accountRouter.get(
  '/profile',
  h(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: uid(req) },
      include: { addresses: true },
    });
    if (!user) throw notFound();
    const { passwordHash, idDocPath, idDocMime, idDocReviewNote, ...safe } = user;
    void passwordHash;
    void idDocPath;
    void idDocMime;
    res.json({
      user: {
        ...safe,
        idDocReviewNote: safe.idDocStatus === 'REJECTED' ? idDocReviewNote : null,
      },
    });
  }),
);

accountRouter.patch(
  '/profile',
  h(async (req, res) => {
    const allowed = ['firstName', 'lastName', 'phone', 'companyName', 'vatNumber'] as const;
    const data: Record<string, unknown> = {};
    for (const k of allowed) if (k in req.body) data[k] = req.body[k];
    const user = await prisma.user.update({ where: { id: uid(req) }, data });
    const { passwordHash, idDocPath, idDocMime, idDocReviewNote, ...safe } = user;
    void passwordHash;
    void idDocPath;
    void idDocMime;
    res.json({
      user: {
        ...safe,
        idDocReviewNote: safe.idDocStatus === 'REJECTED' ? idDocReviewNote : null,
      },
    });
  }),
);

/* ---- Pièce d'identité (recto). Fichier privé, obligatoire pour commander. ---- */

accountRouter.get(
  '/id-document',
  h(async (req, res) => {
    const u = await prisma.user.findUnique({
      where: { id: uid(req) },
      select: { idDocStatus: true, idDocUploadedAt: true, idDocReviewNote: true },
    });
    if (!u) throw notFound();
    res.json({
      status: u.idDocStatus,
      uploadedAt: u.idDocUploadedAt,
      reviewNote: u.idDocStatus === 'REJECTED' ? u.idDocReviewNote : null,
      required: true,
    });
  }),
);

accountRouter.post(
  '/id-document',
  idUpload.single('file'),
  h(async (req, res) => {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) throw badRequest('Aucun fichier — ajoutez une photo de votre carte d’identité.');
    const stored = await storeIdDocument(uid(req), {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
    await prisma.user.update({
      where: { id: uid(req) },
      data: {
        idDocPath: stored.path,
        idDocMime: stored.mime,
        idDocUploadedAt: new Date(),
        idDocStatus: 'PENDING',
        idDocReviewedAt: null,
        idDocReviewNote: null,
      },
    });
    res.status(201).json({ status: 'PENDING' });
  }),
);

/** Le client peut revoir sa propre copie. */
accountRouter.get(
  '/id-document/file',
  h(async (req, res) => {
    const u = await prisma.user.findUnique({
      where: { id: uid(req) },
      select: { idDocPath: true, idDocMime: true },
    });
    if (!u?.idDocPath) throw notFound();
    const buf = await readPrivateFile(u.idDocPath);
    if (!buf) throw notFound();
    res.setHeader('Content-Type', u.idDocMime ?? 'image/webp');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buf);
  }),
);

accountRouter.delete(
  '/id-document',
  h(async (req, res) => {
    const u = await prisma.user.findUnique({
      where: { id: uid(req) },
      select: { idDocPath: true },
    });
    if (u?.idDocPath) await deletePrivateFile(u.idDocPath);
    await prisma.user.update({
      where: { id: uid(req) },
      data: {
        idDocPath: null,
        idDocMime: null,
        idDocUploadedAt: null,
        idDocStatus: 'NONE',
        idDocReviewedAt: null,
        idDocReviewNote: null,
      },
    });
    res.status(204).end();
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
