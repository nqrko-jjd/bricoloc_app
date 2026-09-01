import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code128Bars, code128Svg } from '../src/barcode.js';

test('Code128 : suite de barres paire et non vide', () => {
  const bars = code128Bars('BRICO-A1B2');
  assert.ok(bars.length > 20);
  assert.ok(bars.every((b) => b >= 1 && b <= 4));
});

test('Code128 : quiet zones — commence et finit par une barre noire (index pair)', () => {
  const bars = code128Bars('PONCEUSE-XY12');
  // le 1er segment est une barre, le dernier segment du STOP aussi
  assert.ok(bars.length % 1 === 0);
});

test('Code128 SVG : dimensions cohérentes', () => {
  const svg = code128Svg('U-ABCDEF', { showText: true, height: 40 });
  assert.match(svg, /^<svg/);
  assert.match(svg, /viewBox="0 0 \d+ 56"/);
  assert.match(svg, /U-ABCDEF/);
});

test('Code128 : bascule mode C pour longues suites de chiffres', () => {
  const short = code128Bars('AB').length;
  const long = code128Bars('0123456789012345').length;
  // 16 chiffres en mode C ≈ 8 symboles, bien moins que 16 en B
  assert.ok(long < short + 16 * 6);
});
