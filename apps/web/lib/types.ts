export interface Availability {
  productId: string;
  requestedQty: number;
  availableQty: number;
  totalUnits: number;
  status: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE' | 'NEARBY';
  nearbyPeriod?: { start: string; end: string } | null;
  alternativeProductIds: string[];
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  kind: string;
  shortDescription: string | null;
  images: string[];
  image: string | null;
  category: { slug: string; name: string; bolt: string | null } | null;
  dailyPrice: number;
  weekendPrice: number | null;
  weekPrice: number | null;
  deposit: number;
  isConsumable: boolean;
  isDemo: boolean;
  totalStock: number;
  availability?: Availability | null;
}

export interface ProductDetail extends ProductSummary {
  description: string | null;
  recommendedUses: string[];
  specs: Record<string, string>;
  includedAccessories: string[];
  manualUrl: string | null;
  documents: { label: string; url: string }[];
  monthPrice: number | null;
  tiers: { minDays: number; perDay: number }[];
  proDiscountPct: number | null;
  recommendedAccessories: LinkedProduct[];
  consumables: LinkedProduct[];
  ppe: LinkedProduct[];
  complementary: LinkedProduct[];
  packItems: LinkedProduct[];
}

export interface LinkedProduct {
  id: string;
  slug: string;
  name: string;
  kind: string;
  quantity: number;
  dailyPrice: number;
  deposit: number;
  image: string | null;
  isConsumable: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  bolt: string | null;
  description: string | null;
  productCount?: number;
}

export interface QuoteLine {
  productId: string;
  name: string;
  kind: string;
  quantity: number;
  billedDays: number;
  appliedRule: string;
  unitPriceHT: number;
  lineHT: number;
  depositUnit: number;
  depositLine: number;
  isConsumable: boolean;
}

export interface CartTotals {
  rentalHT: number;
  deliveryFeeHT: number;
  extraFeesHT: number;
  discountHT: number;
  totalHT: number;
  vatRate: number;
  vatAmount: number;
  totalTVAC: number;
  depositsTotal: number;
  amountDue: number;
}

export interface Quote {
  lines: QuoteLine[];
  totals: CartTotals;
  deliveryFeeHT: number;
  deliveryReason?: string;
  discountHT: number;
  promoCode?: string | null;
  promoLabel?: string | null;
  currency: string;
  vatRate: number;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  name: string;
  slug: string;
  kind: string;
  image: string | null;
  dailyPrice: number;
  deposit: number;
  isConsumable: boolean;
  availability: Availability | null;
}

export interface RecommendationGroup {
  type: string;
  label: string;
  products: {
    id: string;
    slug: string;
    name: string;
    kind: string;
    shortDescription: string | null;
    image: string | null;
    dailyPrice: number;
    deposit: number;
    isConsumable: boolean;
  }[];
}

export interface Cart {
  cartKey: string;
  userId: string | null;
  period: { start: string; end: string } | null;
  fulfilmentMode: 'PICKUP' | 'DELIVERY' | null;
  address: Record<string, unknown> | null;
  slot: string | null;
  promoCode: string | null;
  itemCount: number;
  items: CartItem[];
  availabilityAlerts: Availability[];
  hasBlockingIssue: boolean;
  quote: Quote | null;
  recommendations: RecommendationGroup[];
}

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  customerType: 'PARTICULIER' | 'PRO';
  companyName: string | null;
  vatNumber: string | null;
}

export interface Reservation {
  id: string;
  number: string;
  qrToken: string;
  status: string;
  channel: string;
  periodStart: string;
  periodEnd: string;
  fulfilmentMode: string;
  address: Record<string, unknown> | null;
  slot: string | null;
  totals: CartTotals;
  createdAt: string;
  items: {
    id: string;
    productId: string;
    nameSnapshot: string;
    kind: string;
    quantity: number;
    unitPriceHT: number;
    lineHT: number;
    depositUnit: number;
    billedDays: number;
    appliedRule: string;
  }[];
  payments: { id: string; kind: string; status: string; amount: number }[];
  deposit: { amount: number; status: string; capturedAmount: number } | null;
  deliveries: { id: string; direction: string; status: string; feeHT: number }[];
  invoices: { id: string; number: string; kind: string; issuedAt: string }[];
}

export interface PublicConfig {
  brand: {
    name: string;
    tagline: string;
    taglineAlt: string;
    colors: Record<string, string>;
  };
  company: Record<string, string>;
  vatRate: number;
  currency: string;
  minLeadTimeHours: number;
  sameDayCutoffHour: number;
  deliveryBaseFee: number;
  deliveryFreeThreshold: number;
  demo: boolean;
}
