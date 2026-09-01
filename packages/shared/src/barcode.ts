/**
 * Encodeur Code 128 (sous-ensemble B + bascule C pour les chiffres) → suite de
 * largeurs de barres. Sans dépendance : sert à générer des étiquettes SVG.
 */

// 107 motifs Code128 : chaque valeur = 6 largeurs (barre, espace, …).
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const START_B = 104;
const START_C = 105;
const CODE_C = 99;
const CODE_B = 100;
const STOP = 106;

/** Renvoie la liste des largeurs de barres (unités) pour encoder `text` en Code128. */
export function code128Bars(text: string): number[] {
  const codes: number[] = [];
  let i = 0;
  // Démarre en C si ≥ 4 chiffres, sinon en B.
  const digitsAtStart = /^\d{4,}/.test(text);
  let mode: 'B' | 'C' = digitsAtStart ? 'C' : 'B';
  codes.push(mode === 'C' ? START_C : START_B);

  while (i < text.length) {
    if (mode === 'C') {
      const pair = text.slice(i, i + 2);
      if (/^\d{2}$/.test(pair) && (text.length - i >= 2)) {
        codes.push(parseInt(pair, 10));
        i += 2;
        continue;
      }
      codes.push(CODE_B);
      mode = 'B';
    }
    // mode B
    const remaining = text.length - i;
    if (/^\d{4,}$/.test(text.slice(i)) || (remaining >= 6 && /^\d{6}/.test(text.slice(i)))) {
      codes.push(CODE_C);
      mode = 'C';
      continue;
    }
    const c = text.charCodeAt(i);
    codes.push(c - 32);
    i += 1;
  }

  // Somme de contrôle.
  let sum = codes[0]!;
  for (let k = 1; k < codes.length; k++) sum += codes[k]! * k;
  codes.push(sum % 103);
  codes.push(STOP);

  const bars: number[] = [];
  for (const c of codes) {
    for (const ch of PATTERNS[c]!) bars.push(Number(ch));
  }
  return bars;
}

/** Génère un `<svg>` Code128 (chaîne). `unit` = largeur d'une unité en px. */
export function code128Svg(
  text: string,
  opts: { unit?: number; height?: number; showText?: boolean } = {},
): string {
  const unit = opts.unit ?? 1.6;
  const height = opts.height ?? 48;
  const bars = code128Bars(text);
  const width = bars.reduce((a, b) => a + b, 0) * unit;
  let x = 0;
  let rects = '';
  bars.forEach((w, idx) => {
    if (idx % 2 === 0) {
      rects += `<rect x="${x.toFixed(2)}" y="0" width="${(w * unit).toFixed(2)}" height="${height}" fill="#000"/>`;
    }
    x += w * unit;
  });
  const label = opts.showText
    ? `<text x="${width / 2}" y="${height + 12}" font-size="10" text-anchor="middle" font-family="monospace">${text}</text>`
    : '';
  const totalH = opts.showText ? height + 16 : height;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(0)} ${totalH}" width="${width.toFixed(0)}" height="${totalH}">${rects}${label}</svg>`;
}
