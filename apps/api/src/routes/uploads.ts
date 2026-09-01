import { Router } from 'express';
import multer from 'multer';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { badRequest, h, notFound } from '../lib/http.js';
import { attachPrincipal, requireStaff } from '../lib/auth.js';
import { storeImage } from '../lib/media.js';

export const uploadsRouter = Router();
uploadsRouter.use(attachPrincipal, requireStaff());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 20 },
});

/** Téléverse une ou plusieurs images. Retourne les MediaAsset créés. */
uploadsRouter.post(
  '/',
  upload.array('files', 20),
  h(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw badRequest('Aucun fichier');
    const staffId = req.principal?.id;
    const results = [];
    for (const f of files) {
      results.push(
        await storeImage(
          { buffer: f.buffer, mimetype: f.mimetype, originalname: f.originalname },
          { createdBy: staffId },
        ),
      );
    }
    res.status(201).json({ media: results });
  }),
);

/** Bibliothèque de médias (pagination simple). */
uploadsRouter.get(
  '/',
  h(async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 40)));
    const [total, items] = await Promise.all([
      prisma.mediaAsset.count(),
      prisma.mediaAsset.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({
      total,
      page,
      pageSize,
      media: items.map((m) => ({
        id: m.id,
        url: m.url,
        thumbUrl: m.url.replace(/\.webp$/, '.thumb.webp'),
        width: m.width,
        height: m.height,
        bytes: m.bytes,
        createdAt: m.createdAt,
      })),
    });
  }),
);

/** Supprime un média (fichier + vignette + ligne). */
uploadsRouter.delete(
  '/:id',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.id! } });
    if (!asset) throw notFound('Média introuvable');
    const abs = path.join(env.uploadsDir, asset.path);
    await unlink(abs).catch(() => undefined);
    await unlink(abs.replace(/\.webp$/, '.thumb.webp')).catch(() => undefined);
    await prisma.mediaAsset.delete({ where: { id: asset.id } });
    res.json({ ok: true });
  }),
);
