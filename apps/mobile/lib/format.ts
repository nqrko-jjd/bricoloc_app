export function formatEUR(n: number): string {
  return new Intl.NumberFormat('fr-BE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(n);
}

/** Date valide ou null (évite le crash « Invalid time value »). */
function toDate(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  const d = typeof input === 'string' ? new Date(input) : input;
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
}

export function formatDateBE(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '—';
  return new Intl.DateTimeFormat('fr-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTimeBE(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '—';
  return new Intl.DateTimeFormat('fr-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** Ajoute n jours a maintenant, heure fixee. */
export function inDays(days: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}
