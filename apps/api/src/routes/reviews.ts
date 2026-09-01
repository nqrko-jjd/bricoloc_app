import { Router } from 'express';
import { createReviewSchema } from '@bricoloc/shared';
import { prisma } from '../db.js';
import { badRequest, h, notFound } from '../lib/http.js';
import { attachPrincipal } from '../lib/auth.js';

export const reviewsRouter = Router();
reviewsRouter.use(attachPrincipal);

/** Avis publiés d'un produit + note moyenne + répartition. */
reviewsRouter.get(
  '/products/:slug/reviews',
  h(async (req, res) => {
    const product = await prisma.product.findUnique({ where: { slug: req.params.slug! } });
    if (!product) throw notFound('Produit introuvable');

    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize ?? 10)));

    const [rows, all] = await Promise.all([
      prisma.review.findMany({
        where: { productId: product.id, status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.review.findMany({
        where: { productId: product.id, status: 'PUBLISHED' },
        select: { rating: true },
      }),
    ]);

    const count = all.length;
    const avg = count ? Math.round((all.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
    const distribution = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: all.filter((r) => r.rating === star).length,
    }));

    res.json({
      summary: { avg, count, distribution },
      page,
      pageSize,
      reviews: rows.map((r) => ({
        id: r.id,
        authorName: r.authorName,
        rating: r.rating,
        title: r.title,
        body: r.body,
        reply: r.reply,
        createdAt: r.createdAt,
        publishedAt: r.publishedAt,
      })),
    });
  }),
);

/**
 * Dépôt d'un avis. Publié directement si l'auteur est un client connecté ayant
 * effectivement loué le produit (avis vérifié) ; sinon mis en modération.
 */
reviewsRouter.post(
  '/reviews',
  h(async (req, res) => {
    const data = createReviewSchema.parse(req.body);
    const product = await prisma.product.findUnique({ where: { slug: data.productSlug } });
    if (!product) throw notFound('Produit introuvable');

    const principal = req.principal?.kind === 'user' ? req.principal : null;
    let user = null as null | { id: string; firstName: string; lastName: string };
    if (principal) {
      user = await prisma.user.findUnique({
        where: { id: principal.id },
        select: { id: true, firstName: true, lastName: true },
      });
    }

    const authorName =
      (user ? `${user.firstName} ${user.lastName.charAt(0)}.` : data.authorName)?.trim();
    if (!authorName) throw badRequest('Nom requis');

    // Avis vérifié : le client a une réservation passée contenant ce produit.
    let verified = false;
    if (user) {
      const past = await prisma.reservation.findFirst({
        where: {
          userId: user.id,
          status: { in: ['CLOSED', 'RETURNED', 'OUT', 'RETURN_PENDING'] },
          items: { some: { productId: product.id } },
        },
        select: { id: true },
      });
      verified = Boolean(past);

      // Un seul avis par client et par produit.
      const existing = await prisma.review.findFirst({
        where: { productId: product.id, userId: user.id },
      });
      if (existing) throw badRequest('Vous avez déjà laissé un avis pour ce produit.');
    }

    const review = await prisma.review.create({
      data: {
        productId: product.id,
        userId: user?.id ?? null,
        reservationId: null,
        authorName,
        rating: data.rating,
        title: data.title ?? null,
        body: data.body,
        status: verified ? 'PUBLISHED' : 'PENDING',
        publishedAt: verified ? new Date() : null,
      },
    });

    res.status(201).json({
      ok: true,
      status: review.status,
      message:
        review.status === 'PUBLISHED'
          ? 'Merci ! Votre avis est publié.'
          : 'Merci ! Votre avis sera publié après vérification.',
    });
  }),
);
