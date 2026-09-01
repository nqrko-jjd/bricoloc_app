/**
 * Constantes metier BRICOLOC.
 * Toutes les valeurs commerciales (TVA, frais, coordonnees) sont des DEFAUTS
 * surchargeables depuis l'administration (table Setting). Donnees de demo = FICTIVES.
 */

export const BRAND = {
  name: 'BRICOLOC',
  tagline: 'LE BON OUTIL. AU BON MOMENT.',
  taglineAlt: "C'EST BRICOLOC.",
  taglineAlt2: 'LOUEZ MIEUX, TRAVAILLEZ MIEUX.',
  colors: {
    primary: '#EE2C24', // rouge de marque (accent unique)
    navy: '#16335C', // marine adouci — grands aplats
    navyDeep: '#0B1D3A', // marine exact — logo, texte, pied de page
    white: '#FFFFFF',
    ink: '#15213A',
    mutedFg: '#586074',
    // alias hérités
    brico: '#EE2C24',
    loc: '#0B1D3A',
    darkGray: '#15213A',
    lightGray: '#586074',
  },
} as const;

/** Fuseau horaire de reference pour l'affichage et les calculs de jours. */
export const TIMEZONE = 'Europe/Brussels';
/** Locale BCP-47 pour le formatage Intl (montants, dates). Distinct de la langue de routing (`i18n.ts`). */
export const DEFAULT_FORMAT_LOCALE = 'fr-BE';
export const SUPPORTED_LOCALES = ['fr', 'nl', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const CURRENCY = 'EUR';

/** Parametres economiques par defaut (surchargeables en admin). */
export const DEFAULT_SETTINGS = {
  vatRate: 0.21,
  currency: CURRENCY,
  /** Retour le meme jour avant cette heure = 1 jour facture. */
  sameDayCutoffHour: 18,
  /** Regle week-end : retrait vendredi/samedi, retour lundi = 1 jour facture. */
  weekendRuleEnabled: true,
  weekendReturnGraceHour: 10, // lundi avant 10h
  /** Multiplicateur applique au tarif jour pour les frais de retard. */
  lateFeeMultiplier: 1.5,
  /** Delai (heures) de preparation minimal avant un retrait. */
  minLeadTimeHours: 2,
  /** Frais de livraison de demo. */
  deliveryBaseFee: 25,
  deliveryPerKm: 1.2,
  deliveryFreeThreshold: 250, // location HTVA au-dela de laquelle la livraison est offerte
  cleaningFeeDefault: 20,
  /** Reduction longue duree appliquee automatiquement (paliers). */
  proDiscountPctDefault: 0.1,
  /** Coordonnees societe - FICTIVES, a completer en admin. */
  company: {
    legalName: 'BRICOLOC SRL (demo)',
    vatNumber: 'BE 0123.456.789 (demo)',
    address: 'Rue de la Demo 1, 1000 Bruxelles (demo)',
    phone: '+32 2 000 00 00 (demo)',
    email: 'contact@bricoloc.example',
    iban: 'BE00 0000 0000 0000 (demo)',
  },
} as const;

export const CATEGORIES = [
  { slug: 'percage-demolition', name: 'Perçage et démolition', bolt: 'chantier' },
  { slug: 'sciage-decoupe', name: 'Sciage et découpe', bolt: 'chantier' },
  { slug: 'poncage', name: 'Ponçage', bolt: 'chantier' },
  { slug: 'peinture', name: 'Peinture', bolt: 'peinture' },
  { slug: 'nettoyage', name: 'Nettoyage', bolt: 'nettoyage' },
  { slug: 'jardin', name: 'Jardin', bolt: 'jardin' },
  { slug: 'terrassement', name: 'Terrassement', bolt: 'chantier' },
  { slug: 'carrelage', name: 'Carrelage', bolt: 'carrelage' },
  { slug: 'plomberie', name: 'Plomberie', bolt: 'plomberie' },
  { slug: 'electricite', name: 'Électricité', bolt: 'electricite' },
  { slug: 'levage-manutention', name: 'Levage et manutention', bolt: 'chantier' },
  { slug: 'equipement-chantier', name: 'Équipement de chantier', bolt: 'chantier' },
] as const;

export const BOLT_CATEGORIES = [
  'chantier',
  'electricite',
  'peinture',
  'jardin',
  'carrelage',
  'plomberie',
  'nettoyage',
] as const;
export type BoltCategory = (typeof BOLT_CATEGORIES)[number];

/** Type d'article au catalogue. */
export const PRODUCT_KINDS = ['MACHINE', 'ACCESSORY', 'CONSUMABLE', 'PPE', 'PACK'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

/** Type de client. */
export const CUSTOMER_TYPES = ['PARTICULIER', 'PRO'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

/** Roles equipe BRICOLOC. */
export const STAFF_ROLES = [
  'ADMIN',
  'RESPONSABLE',
  'COMPTOIR',
  'PREPARATEUR',
  'LIVREUR',
  'TECHNICIEN',
  'COMPTABILITE',
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Statuts d'une reservation. */
export const RESERVATION_STATUSES = [
  'DRAFT', // panier converti, paiement non finalise
  'CONFIRMED', // payee, en attente de preparation
  'PREPARING', // preparateur en cours
  'READY', // materiel pret (Click & Collect / livraison)
  'OUT', // location active (retire ou livre)
  'RETURN_PENDING', // retour attendu / en retard
  'RETURNED', // materiel rendu, controle en cours
  'CLOSED', // cloturee, facture finale emise
  'CANCELLED',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const FULFILMENT_MODES = ['PICKUP', 'DELIVERY'] as const;
export type FulfilmentMode = (typeof FULFILMENT_MODES)[number];

export const PAYMENT_STATUSES = ['PENDING', 'AUTHORIZED', 'PAID', 'REFUNDED', 'FAILED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DEPOSIT_STATUSES = ['HELD', 'PARTIAL_RELEASE', 'RELEASED', 'CAPTURED'] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

export const UNIT_STATES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'DAMAGED', 'RETIRED'] as const;
export type UnitState = (typeof UNIT_STATES)[number];

export const NOTIFICATION_TYPES = [
  'RESERVATION_CONFIRMED',
  'EQUIPMENT_READY',
  'PICKUP_REMINDER',
  'DELIVERY_ON_THE_WAY',
  'RETURN_REMINDER',
  'DUE_SOON',
  'RETURN_CONFIRMED',
  'DEPOSIT_RELEASED',
  'GENERIC',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const DELIVERY_STATUSES = [
  'REQUESTED',
  'SCHEDULED',
  'ASSIGNED',
  'IN_TRANSIT',
  'DELIVERED',
  'PICKUP_SCHEDULED',
  'COLLECTED',
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
