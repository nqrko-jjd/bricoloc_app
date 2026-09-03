export interface Availability {
  status: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE' | 'NEARBY';
  availableQty: number;
  requestedQty: number;
  nearbyPeriod?: { start: string; end: string } | null;
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  kind: string;
  shortDescription: string | null;
  image: string | null;
  images: string[];
  category: { name: string; slug: string } | null;
  brand?: string | null;
  dailyPrice: number;
  weekendPrice: number | null;
  deposit: number;
  isConsumable: boolean;
  rating?: { avg: number; count: number } | null;
  availability?: Availability | null;
}

export interface ProductDetail extends ProductSummary {
  description: string | null;
  brand?: string | null;
  weekPrice?: number | null;
  monthPrice?: number | null;
  specs: Record<string, string>;
  recommendedUses: string[];
  includedAccessories: string[];
  tiers: { minDays: number; perDay: number }[];
  rating?: { avg: number; count: number } | null;
  recommendedAccessories: LinkedProduct[];
  consumables: LinkedProduct[];
  ppe: LinkedProduct[];
}
export interface LinkedProduct {
  id: string;
  slug: string;
  name: string;
  quantity: number;
  dailyPrice: number;
  weekPrice?: number | null;
  monthPrice?: number | null;
  isConsumable: boolean;
  brand?: string | null;
  shortDescription?: string | null;
  image?: string | null;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  name: string;
  slug: string;
  image: string | null;
  dailyPrice: number;
  deposit: number;
  isConsumable: boolean;
  availability: Availability | null;
}

export interface Quote {
  lines: { productId: string; name: string; quantity: number; lineHT: number; billedDays: number }[];
  totals: {
    rentalHT: number;
    totalHT: number;
    vatRate: number;
    vatAmount: number;
    totalTVAC: number;
    depositsTotal: number;
    amountDue: number;
    deliveryFeeHT: number;
    discountHT: number;
    promoDiscountHT?: number;
    composedPackDiscountHT?: number;
    composedPackPct?: number;
  };
  promoLabel?: string | null;
  composedPack?: {
    machineCount: number;
    pct: number;
    discountHT: number;
    next: { minMachines: number; pct: number } | null;
  };
}

export interface Cart {
  cartKey: string;
  period: { start: string; end: string } | null;
  fulfilmentMode: string | null;
  itemCount: number;
  items: CartItem[];
  availabilityAlerts: (Availability & { productId: string })[];
  hasBlockingIssue: boolean;
  quote: Quote | null;
  recommendations: {
    type: string;
    label: string;
    products: { id: string; name: string; dailyPrice: number; isConsumable: boolean }[];
  }[];
}

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  customerType: string;
  companyName: string | null;
}

export interface Reservation {
  id: string;
  number: string;
  qrToken: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  fulfilmentMode: string;
  slot: string | null;
  totals: { totalTVAC: number; depositsTotal: number };
  items: { id: string; nameSnapshot: string; quantity: number; kind: string; billedDays: number; lineHT: number }[];
  payments: { id: string; kind: string; status: string; amount: number }[];
  deposit: { amount: number; status: string } | null;
  invoices: { id: string; number: string; kind: string }[];
}

export interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}
