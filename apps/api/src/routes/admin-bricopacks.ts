/**
 * Back-office — éditeur de BricoPacks.
 *   GET    /api/admin/bricopacks               liste
 *   POST   /api/admin/bricopacks               crée un pack vide
 *   GET    /api/admin/bricopacks/:id           détail (composition + méta)
 *   PUT    /api/admin/bricopacks/:id           enregistre tout
 *   DELETE /api/admin/bricopacks/:id           dépublie (soft)
 *   GET    /api/admin/bricopacks/pick/machines?q=   recherche de machines à composer
 *
 * Source de vérité de la composition = liens `ProductLink` type PACK_ITEM
 * (toId = machine, quantity). Le `packMeta.items` (slug + rôle + « pourquoi »)
 * est resynchronisé à chaque enregistrement pour la fiche publique.
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { badRequest, h, notFound } from '../lib/http.js';
import { requireStaff } from '../lib/auth.js';

export const adminBricoPacksRouter = Router();

const firstImage = (images: unknown): string | null =>
  Array.isArray(images) && typeof images[0] === 'string' ? (images[0] as string) : null;

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

type PackMeta = {
  family?: string;
  level?: string | null;
  teamSize?: string | null;
  popular?: boolean;
  discountPct?: number | null;
  separateTotal?: number | null;
  items?: { slug: string; role?: string; why?: string; name?: string; dailyPrice?: number; productId?: string; kind?: string; quantity?: number }[];
  consumables?: { label: string; detail?: string; price?: number }[];
  related?: string[];
};

const componentSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(20).default(1),
  role: z.string().max(40).default(''),
  why: z.string().max(400).default(''),
});

const upsertSchema = z.object({
  name: z.string().min(2).max(120),
  intro: z.string().max(600).default(''),
  published: z.boolean().default(false),
  dailyPrice: z.number().min(0).default(0),
  weekPrice: z.number().min(0).nullable().optional(),
  monthPrice: z.number().min(0).nullable().optional(),
  deposit: z.number().min(0).default(0),
  family: z.string().max(40).default('autres'),
  level: z.string().max(40).nullable().optional(),
  teamSize: z.string().max(40).nullable().optional(),
  popular: z.boolean().default(false),
  discountPct: z.number().min(0).max(0.9).default(0.3),
  components: z.array(componentSchema).default([]),
  consumables: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        detail: z.string().max(160).default(''),
        price: z.number().min(0).default(0),
      }),
    )
    .default([]),
});

/* --------------------------------- Liste --------------------------------- */
adminBricoPacksRouter.get(
  '/',
  h(async (_req, res) => {
    const rows = await prisma.product.findMany({
      where: { kind: 'PACK' },
      orderBy: [{ published: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        published: true,
        dailyPrice: true,
        deposit: true,
        images: true,
        packMeta: true,
      },
    });
    const linkCounts = await prisma.productLink.groupBy({
      by: ['fromId'],
      where: { type: 'PACK_ITEM', fromId: { in: rows.map((r) => r.id) } },
      _sum: { quantity: true },
    });
    const qtyByPack = new Map(linkCounts.map((l) => [l.fromId, l._sum.quantity ?? 0]));
    res.json({
      packs: rows.map((r) => {
        const m = (r.packMeta ?? {}) as PackMeta;
        return {
          id: r.id,
          slug: r.slug,
          name: r.name,
          published: r.published,
          dailyPrice: r.dailyPrice,
          deposit: r.deposit,
          family: m.family ?? 'autres',
          popular: !!m.popular,
          separateTotal: m.separateTotal ?? null,
          itemCount: qtyByPack.get(r.id) ?? 0,
          image: firstImage(r.images),
        };
      }),
    });
  }),
);

/* ------------------------- Recherche de machines ------------------------- */
adminBricoPacksRouter.get(
  '/pick/machines',
  h(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const rows = await prisma.product.findMany({
      where: {
        kind: { in: ['MACHINE', 'ACCESSORY'] },
        ...(q ? { OR: [{ name: { contains: q } }, { slug: { contains: q } }, { brand: { contains: q } }] } : {}),
      },
      orderBy: { name: 'asc' },
      take: q ? 40 : 60,
      select: {
        id: true,
        slug: true,
        name: true,
        kind: true,
        brand: true,
        images: true,
        dailyPrice: true,
        deposit: true,
        published: true,
        supplier: true,
      },
    });
    res.json({
      machines: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        kind: r.kind,
        brand: r.brand,
        image: firstImage(r.images),
        dailyPrice: r.dailyPrice,
        deposit: r.deposit,
        published: r.published,
        supplier: r.supplier,
      })),
    });
  }),
);

/* --------------------------------- Détail -------------------------------- */
async function packDetail(id: string) {
  const p = await prisma.product.findFirst({ where: { id, kind: 'PACK' } });
  if (!p) throw notFound('BricoPack introuvable');
  const m = (p.packMeta ?? {}) as PackMeta;

  const links = await prisma.productLink.findMany({
    where: { fromId: id, type: 'PACK_ITEM' },
    include: {
      to: {
        select: { id: true, slug: true, name: true, kind: true, brand: true, images: true, dailyPrice: true, deposit: true, supplier: true },
      },
    },
  });
  const roleBySlug = new Map((m.items ?? []).map((it) => [it.slug, { role: it.role ?? '', why: it.why ?? '' }]));

  const components = links.map((l) => {
    const meta = roleBySlug.get(l.to.slug) ?? { role: '', why: '' };
    return {
      productId: l.to.id,
      slug: l.to.slug,
      name: l.to.name,
      kind: l.to.kind,
      brand: l.to.brand,
      supplier: l.to.supplier,
      image: firstImage(l.to.images),
      dailyPrice: l.to.dailyPrice,
      deposit: l.to.deposit,
      quantity: Math.max(1, l.quantity),
      role: meta.role,
      why: meta.why,
    };
  });

  const separateTotal = components.reduce((a, c) => a + c.dailyPrice * c.quantity, 0);
  const depositTotal = Math.round(components.reduce((a, c) => a + c.deposit * c.quantity, 0));
  const discountPct = m.discountPct ?? 0.3;

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    intro: p.shortDescription ?? '',
    published: p.published,
    dailyPrice: p.dailyPrice,
    weekPrice: p.weekPrice,
    monthPrice: p.monthPrice,
    deposit: p.deposit,
    family: m.family ?? 'autres',
    level: m.level ?? null,
    teamSize: m.teamSize ?? null,
    popular: !!m.popular,
    discountPct,
    components,
    consumables: (m.consumables ?? []).map((c) => ({
      label: c.label,
      detail: c.detail ?? '',
      price: c.price ?? 0,
    })),
    // Suggestions calculées (le formulaire propose de les appliquer).
    separateTotal,
    suggestedDailyPrice: Math.max(1, Math.round(separateTotal * (1 - discountPct))),
    suggestedDeposit: depositTotal,
  };
}

adminBricoPacksRouter.get(
  '/:id',
  h(async (req, res) => {
    res.json({ pack: await packDetail(String(req.params.id)) });
  }),
);

/* --------------------------------- Créer -------------------------------- */
adminBricoPacksRouter.post(
  '/',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (name.length < 2) throw badRequest('Nom requis.');
    let slug = slugify(name) || `pack-${Date.now()}`;
    if (await prisma.product.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const created = await prisma.product.create({
      data: {
        slug,
        name,
        kind: 'PACK',
        published: false,
        isDemo: false,
        supplier: 'BRICOLOC',
        availabilityMode: 'INSTANT',
        deliveryPolicy: 'STANDARD',
        dailyPrice: 0,
        deposit: 0,
        shortDescription: '',
        description: '',
        packMeta: {
          family: String(req.body?.family ?? 'autres'),
          popular: false,
          discountPct: 0.3,
          items: [],
          consumables: [],
          related: [],
        } as never,
      },
    });
    res.status(201).json({ pack: await packDetail(created.id) });
  }),
);

/* ------------------------------ Enregistrer ----------------------------- */
adminBricoPacksRouter.put(
  '/:id',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.product.findFirst({ where: { id, kind: 'PACK' } });
    if (!existing) throw notFound('BricoPack introuvable');
    const body = upsertSchema.parse(req.body);
    const prevMeta = (existing.packMeta ?? {}) as PackMeta;

    // Charge les machines choisies pour figer nom / prix / caution dans la méta.
    const ids = [...new Set(body.components.map((c) => c.productId))];
    const prods = ids.length
      ? await prisma.product.findMany({
          where: { id: { in: ids } },
          select: { id: true, slug: true, name: true, kind: true, dailyPrice: true, deposit: true },
        })
      : [];
    const byId = new Map(prods.map((p) => [p.id, p]));
    for (const c of body.components) {
      if (!byId.has(c.productId)) throw badRequest(`Machine inconnue : ${c.productId}`);
    }

    const items = body.components.map((c) => {
      const p = byId.get(c.productId)!;
      return {
        slug: p.slug,
        role: c.role || '',
        why: c.why || '',
        name: p.name,
        dailyPrice: p.dailyPrice,
        productId: p.id,
        kind: p.kind,
        quantity: c.quantity,
      };
    });
    const separateTotal = items.reduce((a, it) => a + it.dailyPrice * it.quantity, 0);

    const packMeta: PackMeta = {
      family: body.family,
      level: body.level ?? null,
      teamSize: body.teamSize ?? null,
      popular: body.popular,
      discountPct: body.discountPct,
      separateTotal,
      items,
      consumables: body.consumables,
      related: prevMeta.related ?? [],
    };

    // Nom modifié → on retire la trad. figée (sera régénérée par le script i18n).
    const i18nUpdate =
      existing.name !== body.name || (existing.shortDescription ?? '') !== body.intro
        ? { i18n: undefined as never }
        : {};

    await prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        shortDescription: body.intro,
        description: body.intro,
        published: body.published,
        dailyPrice: body.dailyPrice,
        weekPrice: body.weekPrice ?? Math.round(body.dailyPrice * 4),
        monthPrice: body.monthPrice ?? Math.round(body.dailyPrice * 12),
        deposit: body.deposit,
        packMeta: packMeta as never,
        ...i18nUpdate,
      },
    });

    // Resynchronise la composition réelle (liens PACK_ITEM).
    await prisma.productLink.deleteMany({ where: { fromId: id, type: 'PACK_ITEM' } });
    const byComponent = new Map<string, number>();
    for (const c of body.components)
      byComponent.set(c.productId, (byComponent.get(c.productId) ?? 0) + c.quantity);
    if (byComponent.size)
      await prisma.productLink.createMany({
        data: [...byComponent].map(([toId, quantity]) => ({ fromId: id, toId, type: 'PACK_ITEM', quantity })),
      });

    res.json({ pack: await packDetail(id) });
  }),
);

/* ------------------------------- Dépublier ------------------------------ */
adminBricoPacksRouter.delete(
  '/:id',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    const id = String(req.params.id);
    const p = await prisma.product.findFirst({ where: { id, kind: 'PACK' } });
    if (!p) throw notFound('BricoPack introuvable');
    await prisma.product.update({ where: { id }, data: { published: false } });
    res.json({ ok: true });
  }),
);
