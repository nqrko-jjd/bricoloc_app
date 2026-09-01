/** Helpers de dates pour les <input type="datetime-local">. */

export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

export function fromLocalInput(v: string): string {
  return new Date(v).toISOString();
}

export function defaultPeriod(): { start: string; end: string } {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(8, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(18, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function durationLabel(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const days = Math.max(1, Math.ceil(ms / 86400000));
  return days === 1 ? '1 jour' : `${days} jours`;
}
