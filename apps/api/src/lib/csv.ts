/**
 * Lecture / écriture CSV minimale et correcte (RFC 4180) : gère les guillemets,
 * les virgules et retours à la ligne échappés, le BOM UTF-8 et le séparateur
 * `,` ou `;` (auto-détecté à la lecture). Aucune dépendance.
 */

export type CsvRow = Record<string, string>;

function detectDelimiter(headerLine: string): ',' | ';' | '\t' {
  const counts = {
    ',': (headerLine.match(/,/g) ?? []).length,
    ';': (headerLine.match(/;/g) ?? []).length,
    '\t': (headerLine.match(/\t/g) ?? []).length,
  };
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as ',' | ';' | '\t') || ',';
}

/** Parse un texte CSV en tableau de lignes (tableaux de champs). */
export function parseCsvRaw(input: string): string[][] {
  let text = input.replace(/^﻿/, '');
  if (!text.trim()) return [];
  const firstLine = text.slice(0, text.search(/\r?\n/) === -1 ? text.length : text.search(/\r?\n/));
  const delim = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

/** Parse un CSV avec en-tête → objets clés = noms de colonnes (trim). */
export function parseCsv(input: string): CsvRow[] {
  const raw = parseCsvRaw(input);
  if (raw.length < 1) return [];
  const headers = raw[0].map((h) => h.trim());
  return raw.slice(1).map((cells) => {
    const obj: CsvRow = {};
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? '').trim();
    });
    return obj;
  });
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (value instanceof Date) s = value.toISOString();
  if (/[",;\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Sérialise une liste d'objets en CSV. `columns` fixe l'ordre et l'en-tête. */
export function toCsv<T extends Record<string, unknown>>(
  items: T[],
  columns: (keyof T & string)[],
): string {
  const lines = [columns.join(',')];
  for (const it of items) {
    lines.push(columns.map((c) => escapeCell(it[c])).join(','));
  }
  // BOM pour qu'Excel ouvre l'UTF-8 correctement.
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** Helpers de coercition pour l'import. */
export const csv = {
  str: (v: string | undefined): string | null => {
    const s = (v ?? '').trim();
    return s === '' ? null : s;
  },
  num: (v: string | undefined): number | null => {
    const s = (v ?? '').trim().replace(/\s/g, '').replace(',', '.');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  },
  int: (v: string | undefined): number | null => {
    const n = csv.num(v);
    return n === null ? null : Math.round(n);
  },
  bool: (v: string | undefined): boolean | null => {
    const s = (v ?? '').trim().toLowerCase();
    if (['1', 'true', 'vrai', 'oui', 'yes', 'x', 'ja'].includes(s)) return true;
    if (['0', 'false', 'faux', 'non', 'no', 'nee'].includes(s)) return false;
    return null;
  },
};
