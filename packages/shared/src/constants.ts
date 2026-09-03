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
  /** Frais de livraison (repli si le calcul geo echoue). */
  deliveryBaseFee: 25,
  deliveryPerKm: 1.2,
  deliveryFreeThreshold: 250, // location HTVA au-dela de laquelle la livraison est offerte
  /** Livraison geolocalisee (depuis l'adresse client). Editable en admin. */
  delivery: {
    /** Adresse du depot Bricoloc (Ruisbroek / Sint-Pieters-Leeuw). Coords OSM verifiees. */
    depotAddress: 'Gieterijstraat 49, 1601 Ruisbroek (Sint-Pieters-Leeuw)',
    depotLat: 50.7921009,
    depotLng: 4.2967424,
    /** BRACKETS = tranches de km ; PER_KM = forfait de base + N EUR/km. */
    mode: 'BRACKETS' as 'BRACKETS' | 'PER_KM',
    /** Tranches : jusqu'a maxKm -> feeHT. Trie par maxKm croissant. */
    brackets: [
      { maxKm: 15, feeHT: 25 },
      { maxKm: 30, feeHT: 40 },
      { maxKm: 50, feeHT: 65 },
    ],
    /** Mode PER_KM. */
    baseFeeHT: 20,
    perKmHT: 1.2,
    /** Distance routiere max desservie (au-dela : sur devis / hors zone). */
    maxKm: 50,
    /** Location HTVA au-dela de laquelle la livraison est offerte (0 = jamais). */
    freeThresholdHT: 350,
    /** Facteur applique a la distance a vol d'oiseau si le routage echoue. */
    detourFactor: 1.3,
  },
  /**
   * Points d'enlèvement (Click & Collect). Le stock reste au point principal
   * (`isMain`) ; un point relais implique un délai d'acheminement (`transferHours`).
   * Éditable en admin.
   */
  pickupPoints: [
    {
      id: 'ruisbroek',
      name: 'Dépôt Ruisbroek',
      line1: 'Gieterijstraat 49',
      postalCode: '1601',
      city: 'Ruisbroek (Sint-Pieters-Leeuw)',
      lat: 50.7921009,
      lng: 4.2967424,
      hours: 'Lun–Sam 7h–17h',
      isMain: true,
      transferHours: 0,
      active: true,
    },
    {
      id: 'relais-1',
      name: 'Point relais (à configurer)',
      line1: '',
      postalCode: '',
      city: '',
      lat: null as number | null,
      lng: null as number | null,
      hours: '',
      isMain: false,
      transferHours: 24,
      active: false,
    },
  ],
  cleaningFeeDefault: 20,
  /**
   * Emplacements de rangement au dépôt (racks / étagères, ex. « R-01-A »).
   * Sert à imprimer les étiquettes QR de zone et à l'autocomplétion. La liste
   * effective fusionne ces valeurs avec les emplacements déjà utilisés.
   */
  storageZones: [] as string[],
  /** Reduction longue duree appliquee automatiquement (paliers). */
  proDiscountPctDefault: 0.1,
  /** Partenaire Loiselet (grosses machines / pros). Editable en admin. */
  loiselet: {
    /** Destinataires des demandes de location envoyees a Loiselet. */
    recipients: ['erwin@loiselet.be', 'info@loiselet.be'],
    /** Copie interne (Bricoloc) de chaque demande. Vide = pas de copie. */
    ccBricoloc: '',
    /** Marge Bricoloc sur le prix affiche Loiselet (le client paie le prix affiche). */
    marginPct: 0.25,
    /** Delai de confirmation annonce au client. */
    confirmWithinHours: 1,
  },
  /** Revendeurs de consommables / accessoires (pieces adaptees aux machines). */
  partSuppliers: ['Cipac', 'Lecot', 'Sanimat Wavre', 'BMK'],
  /** Coordonnees societe. TVA / IBAN a confirmer en admin. */
  company: {
    legalName: 'BRICOLOC',
    vatNumber: 'BE 0000.000.000',
    address: 'Gieterijstraat 49, 1601 Ruisbroek (Sint-Pieters-Leeuw)',
    phone: '+32 2 887 77 88',
    email: 'info@bricoloc.be',
    iban: 'BE00 0000 0000 0000',
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
  'PENDING_SUPPLIER', // contient un article partenaire (Loiselet) : demande envoyee, en attente de confirmation
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

/** Mode de reglement d'une commande. `ON_SITE_*` = clic & collect uniquement. */
export const PAYMENT_METHODS = ['ONLINE', 'ON_SITE_CASH', 'ON_SITE_CARD'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Etat du reglement au niveau commande (distinct des Payment individuels). */
export const ORDER_PAYMENT_STATUSES = [
  'PENDING',
  'ON_PICKUP', // a payer a l'enlevement
  'AUTHORIZED', // empreinte posee
  'PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
] as const;
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUSES)[number];

export const DEPOSIT_STATUSES = ['HELD', 'PARTIAL_RELEASE', 'RELEASED', 'CAPTURED'] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

/** Comment la caution est prise. */
export const DEPOSIT_METHODS = [
  'CARD_HOLD', // empreinte carte : bloquee, non debitee (defaut en ligne)
  'CHARGE_REFUND', // encaissee pour de vrai puis remboursee au retour
  'CASH', // liquide au comptoir (clic & collect)
] as const;
export type DepositMethod = (typeof DEPOSIT_METHODS)[number];

/** Provenance d'un article au catalogue. */
export const PRODUCT_SUPPLIERS = ['BRICOLOC', 'LOISELET'] as const;
export type ProductSupplier = (typeof PRODUCT_SUPPLIERS)[number];

/** Statut du flux de demande partenaire (Loiselet). */
export const SUPPLIER_REQUEST_STATUSES = ['REQUESTED', 'CONFIRMED', 'DECLINED'] as const;
export type SupplierRequestStatus = (typeof SUPPLIER_REQUEST_STATUSES)[number];

/** Type de fournisseur. */
export const SUPPLIER_KINDS = ['PARTNER_RENTAL', 'CONSUMABLE', 'EQUIPMENT'] as const;
export type SupplierKind = (typeof SUPPLIER_KINDS)[number];

/** Politique de livraison d'un produit. */
export const DELIVERY_POLICIES = ['STANDARD', 'QUOTE_ONLY'] as const;
export type DeliveryPolicy = (typeof DELIVERY_POLICIES)[number];

/** Mode de disponibilite d'un produit. */
export const AVAILABILITY_MODES = ['INSTANT', 'ON_REQUEST'] as const;
export type AvailabilityMode = (typeof AVAILABILITY_MODES)[number];

/** Types de liens entre articles (accessoires / consommables sur la fiche outil). */
export const PRODUCT_LINK_TYPES = [
  'ACCESSORY',
  'CONSUMABLE',
  'PPE',
  'COMPLEMENTARY',
  'PACK_ITEM',
] as const;
export type ProductLinkType = (typeof PRODUCT_LINK_TYPES)[number];

/** Statut d'un avis client. */
export const REVIEW_STATUSES = ['PENDING', 'PUBLISHED', 'REJECTED'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Statut d'une maintenance. */
export const MAINTENANCE_STATUSES = ['PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_TYPES = ['ENTRETIEN', 'REPARATION', 'CONTROLE'] as const;
export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number];

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

export interface PickupPoint {
  id: string;
  name: string;
  line1: string;
  postalCode: string;
  city: string;
  lat: number | null;
  lng: number | null;
  hours: string;
  isMain: boolean;
  /** Délai d'acheminement depuis le point principal (0 pour le principal). */
  transferHours: number;
  active: boolean;
}
