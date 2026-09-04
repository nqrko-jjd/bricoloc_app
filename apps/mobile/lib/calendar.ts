/**
 * Génère un événement iCalendar (.ics) pour une réservation — à ouvrir dans
 * l'agenda du client (iOS / Android / Outlook…). Construit côté client, aucun
 * appel réseau.
 */
export interface IcsEvent {
  uid: string;
  start: string | Date;
  end: string | Date;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Date → format UTC iCal : 20260904T130000Z */
function toIcsDate(d: string | Date): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return (
    `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}` +
    `T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}${pad(x.getUTCSeconds())}Z`
  );
}

/** Échappe les caractères réservés iCal dans une valeur texte. */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

export function buildIcs(ev: IcsEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BRICOLOC//Location//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ev.uid}@bricoloc.be`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(ev.start)}`,
    `DTEND:${toIcsDate(ev.end)}`,
    `SUMMARY:${esc(ev.summary)}`,
  ];
  if (ev.description) lines.push(`DESCRIPTION:${esc(ev.description)}`);
  if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`);
  if (ev.url) lines.push(`URL:${esc(ev.url)}`);
  lines.push(
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Rappel location BRICOLOC',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  );
  return lines.join('\r\n');
}

/** Data-URI ouvrable par l'OS (Linking.openURL / <a href>). */
export function icsDataUri(ev: IcsEvent): string {
  const ics = buildIcs(ev);
  // encodeURIComponent gère l'UTF-8 ; certains clients préfèrent le base64.
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}
