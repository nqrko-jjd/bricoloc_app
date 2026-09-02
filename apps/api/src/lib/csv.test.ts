import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseCsvRaw, toCsv, csv } from './csv.js';

test('parseCsv : en-tête + valeurs, trim', () => {
  const rows = parseCsv('slug,name,price\nponceuse,Ponceuse,12\n');
  assert.deepEqual(rows, [{ slug: 'ponceuse', name: 'Ponceuse', price: '12' }]);
});

test('parseCsv : guillemets, virgule et retour ligne échappés', () => {
  const rows = parseCsv('slug,name\n"a","Perceuse, 18V\nsans fil"\n');
  assert.equal(rows[0].name, 'Perceuse, 18V\nsans fil');
});

test('parseCsv : guillemet doublé', () => {
  const rows = parseCsv('name\n"Disque 125"" diamant"\n');
  assert.equal(rows[0].name, 'Disque 125" diamant');
});

test('parseCsv : séparateur point-virgule auto-détecté + BOM', () => {
  const rows = parseCsv('﻿slug;name\nx;Test\n');
  assert.deepEqual(rows, [{ slug: 'x', name: 'Test' }]);
});

test('parseCsvRaw : ignore les lignes vides', () => {
  assert.equal(parseCsvRaw('a,b\n\n1,2\n\n').length, 2);
});

test('toCsv : ordre des colonnes, échappement, BOM', () => {
  const out = toCsv([{ a: 'x,y', b: 3, c: null }], ['a', 'b', 'c']);
  assert.equal(out, '﻿a,b,c\r\n"x,y",3,\r\n');
});

test('csv.num / int / bool', () => {
  assert.equal(csv.num('1 234,50'), 1234.5);
  assert.equal(csv.num(''), null);
  assert.equal(csv.int('3.7'), 4);
  assert.equal(csv.bool('Oui'), true);
  assert.equal(csv.bool('non'), false);
  assert.equal(csv.bool('peut-être'), null);
});

test('toCsv puis parseCsv : aller-retour', () => {
  const src = [{ slug: 'a-b', name: 'Été; "x"', qty: 5 }];
  const parsed = parseCsv(toCsv(src, ['slug', 'name', 'qty']));
  assert.deepEqual(parsed, [{ slug: 'a-b', name: 'Été; "x"', qty: '5' }]);
});
