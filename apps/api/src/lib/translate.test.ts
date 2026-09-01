import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildI18nText, deeplTranslate, translationEnabled } from './translate.js';

const online = translationEnabled();

test('buildI18nText garde toujours la source FR', async () => {
  const out = await buildI18nText('Perceuse à percussion', {}, { targets: [] });
  assert.equal(out.fr, 'Perceuse à percussion');
});

test('buildI18nText ne réécrit pas une cible déjà présente', async () => {
  const out = await buildI18nText(
    'Ponceuse excentrique',
    { nl: 'Excentrische schuurmachine', en: 'Random orbital sander' },
    { targets: ['nl', 'en'] },
  );
  assert.equal(out.nl, 'Excentrische schuurmachine');
  assert.equal(out.en, 'Random orbital sander');
});

test('DeepL traduit FR -> NL/EN (intégration)', { skip: !online }, async () => {
  const [nl] = await deeplTranslate(['Marteau perforateur'], 'nl');
  assert.ok(nl && nl.length > 0);
  assert.notEqual(nl.toLowerCase(), 'marteau perforateur');

  const out = await buildI18nText('Location d’outillage professionnel', {}, { targets: ['nl', 'en'] });
  assert.ok(out.nl && out.en);
  assert.equal(out.fr, 'Location d’outillage professionnel');
});
