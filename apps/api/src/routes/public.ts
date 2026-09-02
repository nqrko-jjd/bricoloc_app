import { Router } from 'express';
import { BRAND, pickText, SOURCE_LOCALE, type I18nText, type Locale } from '@bricoloc/shared';
import { prisma } from '../db.js';
import { h } from '../lib/http.js';
import { getSettings } from '../lib/settings.js';
import { quoteDelivery } from '../lib/delivery.js';
import { serializeProductSummary, productInclude } from '../lib/serialize.js';

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
      demo: true,
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
    if (!token) return res.status(400).json({ error: { message: 'Code requis' } });
    const r = await prisma.reservation.findFirst({
      where: { OR: [{ qrToken: token }, { number: token }] },
      include: { items: true, user: true, deliveries: true },
    });
    if (!r) return res.status(404).json({ error: { message: 'Reservation introuvable' } });
    res.json({
      reservation: {
        number: r.number,
        status: r.status,
        firstName: r.user?.firstName ?? (r.contact as { firstName?: string })?.firstName ?? null,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        fulfilmentMode: r.fulfilmentMode,
        slot: r.slot,
        items: r.items.map((i) => ({ name: i.nameSnapshot, quantity: i.quantity, kind: i.kind })),
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
