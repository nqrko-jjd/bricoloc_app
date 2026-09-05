import { Router } from 'express';
import { BRAND, pickText, SOURCE_LOCALE, type I18nText, type Locale } from '@bricoloc/shared';
import { prisma } from '../db.js';
import { h, notFound, badRequest } from '../lib/http.js';
import { getSettings } from '../lib/settings.js';
import { quoteDelivery } from '../lib/delivery.js';
import { serializeProductSummary, productInclude } from '../lib/serialize.js';
import { mollieEnabled, mollieTestMode } from '../lib/mollie.js';

export const publicRouter = Router();

/** Parametres publics (sous-ensemble non sensible). */
publicRouter.get(
  '/config',
  h(async (_req, res) => {
    const s = await getSettings();
    res.json({
      brand: BRAND,
      company: s.company,
      vatRate: s.vatRate,
      currency: s.currency,
      minLeadTimeHours: s.minLeadTimeHours,
      sameDayCutoffHour: s.sameDayCutoffHour,
      deliveryBaseFee: s.deliveryBaseFee,
      deliveryFreeThreshold: s.deliveryFreeThreshold,
      pickupPoints: (Array.isArray(s.pickupPoints) ? s.pickupPoints : [])
        .filter((p: { active?: boolean }) => p.active !== false)
        .map((p: Record<string, unknown>) => ({
          id: p.id,
          name: p.name,
          line1: p.line1,
          postalCode: p.postalCode,
          city: p.city,
          hours: p.hours,
          isMain: p.isMain === true,
          transferHours: Number(p.transferHours ?? 0),
        })),
      demo: true,
      paymentProvider: mollieEnabled() ? 'mollie' : 'mock',
      paymentTestMode: mollieEnabled() ? mollieTestMode() : true,
      composedPack: (() => {
        const cp = (s.composedPack ?? {}) as {
          enabled?: boolean;
          tiers?: { minMachines: number; pct: number }[];
        };
        return {
          enabled: cp.enabled !== false,
          tiers: [...(Array.isArray(cp.tiers) ? cp.tiers : [])].sort(
            (a, b) => a.minMachines - b.minMachines,
          ),
        };
      })(),
      homeShowBrand: Boolean(s.homeShowBrand),
      homeShowBadges: s.homeShowBadges === undefined ? true : Boolean(s.homeShowBadges),
    });
  }),
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Inscription « on vous prévient au lancement » (page /application) etc. */
publicRouter.post(
  '/newsletter',
  h(async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const source = req.body?.source ? String(req.body.source).slice(0, 60) : null;
    const locale = req.body?.locale ? String(req.body.locale).slice(0, 5) : null;
    if (!EMAIL_RE.test(email)) throw badRequest('Adresse e-mail invalide.');
    await prisma.newsletterSignup.upsert({
      where: { email },
      update: {},
      create: { email, source, locale },
    });
    res.status(201).json({ ok: true });
  }),
);

/** Produits mis en avant « Ce que louent nos clients » (accueil) — vide si pas de curation manuelle. */
publicRouter.get(
  '/home-featured',
  h(async (req, res) => {
    const locale = (String(req.query.locale ?? 'fr') as Locale) ?? 'fr';
    const s = await getSettings();
    const ids = Array.isArray(s.homeFeaturedProductIds) ? (s.homeFeaturedProductIds as string[]) : [];
    if (ids.length === 0) return res.json({ products: [] });

    const rows = await prisma.product.findMany({
      where: { id: { in: ids }, published: true },
      include: productInclude,
    });
    const byId = new Map(rows.map((p) => [p.id, p]));
    // Conserve l'ordre choisi en admin ; ignore les ids supprimés/dépubliés depuis.
    const ordered = ids.map((id) => byId.get(id)).filter((p): p is (typeof rows)[number] => !!p);

    // « Dans un BricoPack » = la machine compose un pack existant (liens PACK_ITEM).
    const inPackIds = new Set(
      (
        await prisma.productLink.findMany({
          where: { toId: { in: ordered.map((p) => p.id) }, type: 'PACK_ITEM' },
          select: { toId: true },
        })
      ).map((l) => l.toId),
    );

    res.json({
      products: ordered.map((p) => ({
        ...serializeProductSummary(p, locale),
        inPack: inPackIds.has(p.id),
      })),
    });
  }),
);

publicRouter.get(
  '/content/:key',
  h(async (req, res) => {
    const locale = String(req.query.locale ?? 'fr');
    const row =
      (await prisma.content.findUnique({
        where: { key_locale: { key: req.params.key, locale } },
      })) ??
      (await prisma.content.findUnique({
        where: { key_locale: { key: req.params.key, locale: 'fr' } },
      }));
    if (!row) return res.json({ content: null });
    res.json({ content: row });
  }),
);

publicRouter.get(
  '/content',
  h(async (req, res) => {
    const prefix = typeof req.query.prefix === 'string' ? req.query.prefix : undefined;
    const locale = typeof req.query.locale === 'string' ? req.query.locale : undefined;

    // Mode "carte" : ?prefix=home.&locale=nl -> { "home.hero.title": "…", … } avec repli FR.
    if (prefix && locale) {
      const rows = await prisma.content.findMany({
        where: { key: { startsWith: prefix }, locale: { in: [locale, 'fr'] } },
      });
      const map: Record<string, { title: string | null; body: string; format: string }> = {};
      for (const r of rows) {
        const cur = map[r.key];
        // priorité à la locale demandée
        if (!cur || r.locale === locale) {
          map[r.key] = { title: r.title, body: r.body, format: r.format };
        }
      }
      return res.json({ locale, content: map });
    }

    const where = prefix ? { key: { startsWith: prefix } } : {};
    res.json({ content: await prisma.content.findMany({ where }) });
  }),
);

/**
 * Devis de livraison géolocalisé : adresse client -> distance depuis le dépôt ->
 * tarif (tranches de km ou au km, config admin). `rentalHT` applique la franchise.
 */
publicRouter.post(
  '/delivery/quote',
  h(async (req, res) => {
    const { line1, line2, postalCode, city, country, rentalHT } = req.body ?? {};
    const quote = await quoteDelivery(
      { line1, line2, postalCode, city, country },
      Number(rentalHT) || 0,
    );
    res.json(quote);
  }),
);

/** Compat : ancien contrôle par préfixe de code postal (secours). */
publicRouter.post(
  '/delivery/check',
  h(async (req, res) => {
    const postalCode = String(req.body?.postalCode ?? '');
    const quote = await quoteDelivery({ postalCode }, 0);
    res.json({ postalCode, served: quote.served, distanceKm: quote.distanceKm, feeHT: quote.feeHT });
  }),
);

/** Recherche minimale d'une reservation (borne : "J'ai deja une reservation" / scan QR). */
publicRouter.post(
  '/reservation/lookup',
  h(async (req, res) => {
    const token = String(req.body?.token ?? '').trim();
    const name = String(req.body?.name ?? '').trim();
    const phone = String(req.body?.phone ?? '').replace(/\s/g, '');

    const serialize = (r: {
      number: string;
      status: string;
      user: { firstName: string } | null;
      contact: unknown;
      periodStart: Date;
      periodEnd: Date;
      fulfilmentMode: string;
      slot: string | null;
      items: { nameSnapshot: string; quantity: number; kind: string }[];
    }) => ({
      number: r.number,
      status: r.status,
      firstName: r.user?.firstName ?? (r.contact as { firstName?: string })?.firstName ?? null,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      fulfilmentMode: r.fulfilmentMode,
      slot: r.slot,
      items: r.items.map((i) => ({ name: i.nameSnapshot, quantity: i.quantity, kind: i.kind })),
    });

    const inc = { items: true, user: true, deliveries: true } as const;

    // 1) Par code (numéro BRL- ou jeton QR R-)
    if (token) {
      const r = await prisma.reservation.findFirst({
        where: { OR: [{ qrToken: token }, { number: token }] },
        include: inc,
      });
      if (!r) return res.status(404).json({ error: { message: 'Réservation introuvable pour ce code' } });
      return res.json({ reservation: serialize(r) });
    }

    // 2) Par nom + téléphone (au moins l'un des deux + un critère fort)
    if (name && phone && phone.length >= 6) {
      const last4 = phone.slice(-4);
      const rows = await prisma.reservation.findMany({
        where: {
          status: { in: ['CONFIRMED', 'PREPARING', 'READY', 'OUT', 'RETURN_PENDING'] },
          OR: [
            { user: { AND: [{ lastName: { contains: name } }, { phone: { contains: last4 } }] } },
          ],
        },
        include: inc,
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
      // Repli sur le contact (invité) : filtrage en mémoire (JSON).
      const guests = rows.length
        ? []
        : (
            await prisma.reservation.findMany({
              where: { status: { in: ['CONFIRMED', 'PREPARING', 'READY', 'OUT', 'RETURN_PENDING'] } },
              include: inc,
              orderBy: { createdAt: 'desc' },
              take: 200,
            })
          ).filter((r) => {
            const c = r.contact as { lastName?: string; phone?: string } | null;
            return (
              c?.lastName?.toLowerCase().includes(name.toLowerCase()) &&
              c?.phone?.replace(/\s/g, '').endsWith(last4)
            );
          });
      const found = [...rows, ...guests].slice(0, 5);
      if (found.length === 0)
        return res.status(404).json({ error: { message: 'Aucune réservation trouvée' } });
      if (found.length === 1) return res.json({ reservation: serialize(found[0]!) });
      return res.json({ reservations: found.map(serialize) });
    }

    return res.status(400).json({ error: { message: 'Fournissez un code, ou votre nom + téléphone' } });
  }),
);

/* -------------------- Gamme BricoPack -------------------- */

type PackMeta = {
  family?: string;
  level?: string;
  teamSize?: string;
  popular?: boolean;
  discountPct?: number;
  separateTotal?: number;
  items?: { slug: string; role: string; why: string; name?: string; dailyPrice?: number }[];
  consumables?: { label: string; detail: string; price: number; slug?: string | null }[];
  related?: string[];
};

const packName = (p: { name: string; i18n: unknown }, locale: Locale) => {
  if (locale === SOURCE_LOCALE) return p.name;
  const bag = (p.i18n as { name?: I18nText } | null)?.name;
  return pickText(bag, locale, SOURCE_LOCALE) || p.name;
};
const packIntro = (p: { shortDescription: string | null; i18n: unknown }, locale: Locale) => {
  const src = p.shortDescription ?? '';
  if (locale === SOURCE_LOCALE) return src;
  const bag = (p.i18n as { shortDescription?: I18nText } | null)?.shortDescription;
  return pickText(bag, locale, SOURCE_LOCALE) || src;
};

publicRouter.get(
  '/bricopacks',
  h(async (req, res) => {
    const locale = (String(req.query.locale ?? 'fr') as Locale) ?? 'fr';
    const settings = await getSettings();
    const cp = (settings.composedPack ?? {}) as {
      enabled?: boolean;
      tiers?: { minMachines: number; pct: number }[];
    };
    const composedPack = {
      enabled: cp.enabled !== false,
      tiers: [...(Array.isArray(cp.tiers) ? cp.tiers : [])].sort(
        (a, b) => a.minMachines - b.minMachines,
      ),
    };
    const rows = await prisma.product.findMany({
      where: { kind: 'PACK', published: true },
      select: {
        slug: true,
        name: true,
        shortDescription: true,
        i18n: true,
        images: true,
        dailyPrice: true,
        packMeta: true,
      },
    });
    const packs = rows
      .map((p) => {
        const m = (p.packMeta ?? {}) as PackMeta;
        return {
          slug: p.slug,
          name: packName(p, locale),
          intro: packIntro(p, locale),
          family: m.family ?? 'autres',
          level: m.level ?? null,
          teamSize: m.teamSize ?? null,
          popular: !!m.popular,
          dailyPrice: p.dailyPrice,
          separateTotal: m.separateTotal ?? null,
          toolCount: m.items?.length ?? 0,
          image: (p.images as string[] | null)?.[0] ?? null,
        };
      })
      .sort((a, b) => Number(b.popular) - Number(a.popular) || a.name.localeCompare(b.name));
    res.json({ packs, count: packs.length, composedPack });
  }),
);

publicRouter.get(
  '/bricopacks/:slug',
  h(async (req, res) => {
    const locale = (String(req.query.locale ?? 'fr') as Locale) ?? 'fr';
    const p = await prisma.product.findFirst({
      where: { slug: req.params.slug, kind: 'PACK' },
    });
    if (!p || !p.published) throw notFound('BricoPack introuvable');
    const m = (p.packMeta ?? {}) as PackMeta;

    const itemSlugs = (m.items ?? []).map((i) => i.slug);
    const tools = await prisma.product.findMany({
      where: { slug: { in: itemSlugs } },
      select: { slug: true, name: true, i18n: true, images: true, dailyPrice: true, category: { select: { slug: true } } },
    });
    const toolBySlug = Object.fromEntries(tools.map((t) => [t.slug, t]));

    const items = (m.items ?? []).map((it) => {
      const t = toolBySlug[it.slug];
      return {
        slug: it.slug,
        role: it.role,
        why: it.why,
        name: t ? packName(t, locale) : it.name ?? it.slug,
        dailyPrice: t?.dailyPrice ?? it.dailyPrice ?? 0,
        image: t ? ((t.images as string[] | null)?.[0] ?? null) : null,
      };
    });
    const separateTotal = m.separateTotal ?? items.reduce((a, i) => a + i.dailyPrice, 0);

    const related = await prisma.product.findMany({
      where: { slug: { in: m.related ?? [] }, kind: 'PACK', published: true },
      select: { slug: true, name: true, i18n: true, packMeta: true },
    });

    res.json({
      pack: {
        id: p.id,
        slug: p.slug,
        name: packName(p, locale),
        intro: packIntro(p, locale),
        image: (p.images as string[] | null)?.[0] ?? null,
        family: m.family ?? 'autres',
        level: m.level ?? null,
        teamSize: m.teamSize ?? null,
        popular: !!m.popular,
        dailyPrice: p.dailyPrice,
        separateTotal,
        savingPerDay: Math.max(0, separateTotal - p.dailyPrice),
        discountPct: m.discountPct ?? null,
        items,
        consumables: m.consumables ?? [],
        related: related.map((r) => ({
          slug: r.slug,
          name: packName(r, locale),
          family: ((r.packMeta ?? {}) as PackMeta).family ?? null,
        })),
      },
    });
  }),
);

/* -------------------- Magazine « Conseils & DIY » -------------------- */

function guideField(
  g: { title: string; excerpt: string; body: string; i18n: unknown },
  field: 'title' | 'excerpt' | 'body',
  locale: Locale,
): string {
  if (locale === SOURCE_LOCALE) return g[field];
  const bag = (g.i18n as Record<string, I18nText> | null | undefined)?.[field];
  return pickText(bag, locale, SOURCE_LOCALE) || g[field];
}

publicRouter.get(
  '/guides',
  h(async (req, res) => {
    const locale = (String(req.query.locale ?? 'fr') as Locale) ?? 'fr';
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const rows = await prisma.guide.findMany({
      where: { published: true, ...(category ? { category } : {}) },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({
      guides: rows.map((g) => ({
        slug: g.slug,
        category: g.category,
        title: guideField(g, 'title', locale),
        excerpt: guideField(g, 'excerpt', locale),
        readMinutes: g.readMinutes,
        tone: g.tone,
        featured: g.featured,
      })),
      categories: [...new Set(rows.map((g) => g.category))],
    });
  }),
);

publicRouter.get(
  '/guides/:slug',
  h(async (req, res) => {
    const locale = (String(req.query.locale ?? 'fr') as Locale) ?? 'fr';
    const g = await prisma.guide.findFirst({
      where: { slug: req.params.slug, published: true },
    });
    if (!g) return res.status(404).json({ error: { message: 'Guide introuvable' } });

    const relSlugs = (g.relatedSlugs as string[] | null) ?? [];
    const related = relSlugs.length
      ? await prisma.product.findMany({
          where: { slug: { in: relSlugs }, published: true },
          include: productInclude,
        })
      : [];

    const seo = (g.seo as { title?: I18nText; description?: I18nText } | null) ?? {};
    res.json({
      guide: {
        slug: g.slug,
        category: g.category,
        title: guideField(g, 'title', locale),
        excerpt: guideField(g, 'excerpt', locale),
        body: guideField(g, 'body', locale),
        readMinutes: g.readMinutes,
        tone: g.tone,
        updatedAt: g.updatedAt,
        seo: {
          title: pickText(seo.title, locale, SOURCE_LOCALE) || null,
          description: pickText(seo.description, locale, SOURCE_LOCALE) || null,
        },
      },
      related: related.map((p) => serializeProductSummary(p, locale)),
    });
  }),
);

publicRouter.post(
  '/contact',
  h(async (req, res) => {
    const { name, email, message, phone } = req.body ?? {};
    if (!email || !message) return res.status(400).json({ error: { message: 'email et message requis' } });
    const ticket = await prisma.supportTicket.create({
      data: {
        subject: `Contact site : ${name ?? email}`,
        message: `${message}\n\nTel: ${phone ?? '-'} / Email: ${email}`,
      },
    });
    res.status(201).json({ ok: true, ticketId: ticket.id });
  }),
);
