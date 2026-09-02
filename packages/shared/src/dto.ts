import { z } from 'zod';
import {
  CUSTOMER_TYPES,
  FULFILMENT_MODES,
  PRODUCT_KINDS,
  REVIEW_STATUSES,
  STAFF_ROLES,
  UNIT_STATES,
} from './constants.js';

export const isoDate = z.string().datetime({ offset: true }).or(z.string().datetime());

export const periodSchema = z
  .object({ start: isoDate, end: isoDate })
  .refine((p) => new Date(p.start) < new Date(p.end), {
    message: 'La date de retour doit etre posterieure a la date de debut.',
  });
export type PeriodDTO = z.infer<typeof periodSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, '8 caracteres minimum'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(6),
  customerType: z.enum(CUSTOMER_TYPES).default('PARTICULIER'),
  companyName: z.string().optional(),
  vatNumber: z.string().optional(),
});
export type RegisterDTO = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const addressSchema = z.object({
  label: z.string().optional(),
  line1: z.string().min(1),
  line2: z.string().optional(),
  postalCode: z.string().min(4),
  city: z.string().min(1),
  country: z.string().default('BE'),
  isConstructionSite: z.boolean().default(false),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
});
export type AddressDTO = z.infer<typeof addressSchema>;

export const catalogQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  kind: z.enum(PRODUCT_KINDS).optional(),
  start: isoDate.optional(),
  end: isoDate.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'name']).default('relevance'),
  locale: z.enum(['fr', 'nl', 'en']).default('fr'),
});

export const availabilityCheckSchema = z.object({
  period: periodSchema,
  items: z
    .array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1) }))
    .min(1),
});
export type AvailabilityCheckDTO = z.infer<typeof availabilityCheckSchema>;

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
});

export const setCartPeriodSchema = z.object({
  period: periodSchema.nullable(),
});

export const cartFulfilmentSchema = z.object({
  mode: z.enum(FULFILMENT_MODES),
  addressId: z.string().optional(),
  address: addressSchema.optional(),
  slot: z.string().optional(),
  pickupNote: z.string().optional(),
});

export const applyPromoSchema = z.object({ code: z.string().min(1) });

export const checkoutSchema = z.object({
  period: periodSchema,
  fulfilment: cartFulfilmentSchema,
  contact: z
    .object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().min(6),
    })
    .optional(),
  promoCode: z.string().optional(),
  acceptTerms: z.literal(true),
  channel: z.enum(['WEB', 'MOBILE', 'KIOSK']).default('WEB'),
});
export type CheckoutDTO = z.infer<typeof checkoutSchema>;

export const mockPaySchema = z.object({
  reservationId: z.string().min(1),
  /** carte de demo : 'success' ou 'decline'. */
  outcome: z.enum(['success', 'decline']).default('success'),
});

export const extendReservationSchema = z.object({
  newEnd: isoDate,
});

export const reportProblemSchema = z.object({
  reservationId: z.string().min(1),
  subject: z.string().min(1),
  message: z.string().min(1),
});

/* ------------------------- Back-office ------------------------- */

export const staffLoginSchema = loginSchema;

export const upsertCategorySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  bolt: z.string().optional(),
  description: z.string().optional(),
  position: z.number().int().default(0),
});

export const upsertProductSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(PRODUCT_KINDS).default('MACHINE'),
  categorySlug: z.string().optional(),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  recommendedUses: z.array(z.string()).default([]),
  specs: z.record(z.string()).default({}),
  includedAccessories: z.array(z.string()).default([]),
  images: z.array(z.string()).default([]),
  manualUrl: z.string().optional(),
  documents: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  dailyPrice: z.number().min(0),
  weekendPrice: z.number().min(0).nullable().optional(),
  weekPrice: z.number().min(0).nullable().optional(),
  monthPrice: z.number().min(0).nullable().optional(),
  tiers: z
    .array(z.object({ minDays: z.number().int().min(1), perDay: z.number().min(0) }))
    .default([]),
  proDiscountPct: z.number().min(0).max(1).nullable().optional(),
  deposit: z.number().min(0).default(0),
  isDemo: z.boolean().default(true),
  published: z.boolean().default(true),
  // Stock des articles non suivis à l'exemplaire (consommables, petits accessoires).
  stockQty: z.number().int().min(0).nullable().optional(),
  // Provenance interne (non affichée au client) : revendeur, réf. et prix d'achat.
  partSupplier: z.string().nullable().optional(),
  supplierRef: z.string().nullable().optional(),
  supplierUrl: z.string().nullable().optional(),
  supplierListPrice: z.number().min(0).nullable().optional(),
  purchasePrice: z.number().min(0).nullable().optional(),
  recommendedAccessoryIds: z.array(z.string()).default([]),
  consumableIds: z.array(z.string()).default([]),
  ppeIds: z.array(z.string()).default([]),
  complementaryProductIds: z.array(z.string()).default([]),
  packItems: z
    .array(z.object({ productId: z.string(), quantity: z.number().int().min(1) }))
    .default([]),
});
export type UpsertProductDTO = z.infer<typeof upsertProductSchema>;

export const upsertUnitSchema = z.object({
  productId: z.string().min(1),
  assetTag: z.string().min(1),
  serialNumber: z.string().optional(),
  state: z.enum(UNIT_STATES).default('AVAILABLE'),
  notes: z.string().optional(),
  images: z.array(z.string()).default([]),
  nextMaintenanceAt: isoDate.nullable().optional(),
});

export const createStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(STAFF_ROLES),
});

export const pickupChecklistSchema = z.object({
  reservationId: z.string().min(1),
  unitIds: z.array(z.string()).min(1),
  checklist: z.record(z.boolean()),
  photos: z.array(z.string()).default([]),
  customerSignature: z.string().min(1),
  note: z.string().optional(),
});

export const returnChecklistSchema = z.object({
  reservationId: z.string().min(1),
  actualReturnAt: isoDate,
  checklist: z.record(z.boolean()),
  photos: z.array(z.string()).default([]),
  damages: z
    .array(
      z.object({
        unitId: z.string(),
        description: z.string(),
        feeHT: z.number().min(0).default(0),
        photos: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  missingAccessories: z
    .array(z.object({ label: z.string(), feeHT: z.number().min(0).default(0) }))
    .default([]),
  cleaningFeeHT: z.number().min(0).default(0),
  otherFeeHT: z.number().min(0).default(0),
  otherFeeReason: z.string().optional(),
  depositAction: z.enum(['RELEASE', 'PARTIAL', 'CAPTURE']).default('RELEASE'),
  depositCapturedAmount: z.number().min(0).default(0),
  note: z.string().optional(),
});

export const upsertPromoSchema = z.object({
  code: z.string().min(1),
  kind: z.enum(['PERCENT', 'AMOUNT']),
  value: z.number().min(0),
  active: z.boolean().default(true),
  minTotalHT: z.number().min(0).default(0),
  expiresAt: isoDate.nullable().optional(),
});

export const upsertSettingSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
});

/* ------------------------- Avis clients ------------------------- */

export const createReviewSchema = z.object({
  productSlug: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().min(10, '10 caractères minimum').max(2000),
  /** Utilisé si l'auteur n'est pas connecté. */
  authorName: z.string().min(2).max(60).optional(),
  reservationNumber: z.string().optional(),
});
export type CreateReviewDTO = z.infer<typeof createReviewSchema>;

export const moderateReviewSchema = z.object({
  status: z.enum(REVIEW_STATUSES),
  reply: z.string().max(1000).nullable().optional(),
});

export const upsertContentSchema = z.object({
  key: z.string().min(1),
  locale: z.string().default('fr'),
  title: z.string().optional(),
  body: z.string(),
  format: z.enum(['markdown', 'html']).default('markdown'),
  /** true quand un humain valide une version NL/EN (fige la trad auto). */
  markReviewed: z.boolean().default(false),
});

export const upsertDeliveryZoneSchema = z.object({
  name: z.string().min(1),
  postalPrefixes: z.array(z.string()).min(1),
  baseFee: z.number().min(0),
  perKm: z.number().min(0).default(0),
  active: z.boolean().default(true),
});

export const assignDeliverySchema = z.object({
  deliveryId: z.string().min(1),
  driverId: z.string().optional(),
  status: z.string().optional(),
  slot: z.string().optional(),
  signature: z.string().optional(),
  photo: z.string().optional(),
});

export const registerPushTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']),
});
