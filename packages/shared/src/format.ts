import { CURRENCY, DEFAULT_FORMAT_LOCALE, TIMEZONE } from './constants.js';

/** Formate un montant en euros (ex: "1 234,50 €"). */
export function formatEUR(amount: number, locale = DEFAULT_FORMAT_LOCALE): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 2,
  }).format(round2(amount));
}

/** Date au format belge JJ/MM/AAAA. */
export function formatDateBE(input: Date | string, locale = DEFAULT_FORMAT_LOCALE): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TIMEZONE,
  }).format(d);
}

/** Date + heure au format belge JJ/MM/AAAA HH:mm. */
export function formatDateTimeBE(input: Date | string, locale = DEFAULT_FORMAT_LOCALE): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  }).format(d);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Numero de reservation lisible : BRL-YYYYMMDD-XXXX */
export function buildReservationNumber(seq: number, date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `BRL-${y}${m}${day}-${String(seq).padStart(4, '0')}`;
}

export function buildInvoiceNumber(seq: number, date = new Date()): string {
  return `F${date.getFullYear()}-${String(seq).padStart(5, '0')}`;
}
