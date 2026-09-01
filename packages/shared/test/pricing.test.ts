import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeBilledDays,
  computeCartTotals,
  computeLateFee,
  computeRentalPrice,
  isWeekendRule,
  type PricingSettings,
} from '../src/pricing.js';

const settings: PricingSettings = {
  sameDayCutoffHour: 18,
  weekendRuleEnabled: true,
  weekendReturnGraceHour: 10,
  proDiscountPctDefault: 0.1,
};

test('computeBilledDays: retour le meme jour = 1 jour', () => {
  const r = computeBilledDays(
    { start: '2026-09-01T08:00:00', end: '2026-09-01T17:00:00' },
    settings,
  );
  assert.equal(r.billedDays, 1);
});

test('computeBilledDays: 3 jours pleins', () => {
  const r = computeBilledDays(
    { start: '2026-09-01T08:00:00', end: '2026-09-04T08:00:00' },
    settings,
  );
  assert.equal(r.billedDays, 3);
});

test('computeBilledDays: journee entamee = arrondi superieur', () => {
  const r = computeBilledDays(
    { start: '2026-09-01T08:00:00', end: '2026-09-02T10:00:00' },
    settings,
  );
  assert.equal(r.billedDays, 2);
});

test('isWeekendRule: vendredi -> lundi 9h', () => {
  // 2026-09-04 est un vendredi, 2026-09-07 un lundi
  assert.equal(
    isWeekendRule({ start: '2026-09-04T16:00:00', end: '2026-09-07T09:00:00' }, settings),
    true,
  );
});

test('computeRentalPrice: regle week-end applique le tarif week-end', () => {
  const res = computeRentalPrice({
    pricing: { dailyPrice: 40, weekendPrice: 55, deposit: 200 },
    period: { start: '2026-09-04T16:00:00', end: '2026-09-07T09:00:00' },
    quantity: 1,
    customerType: 'PARTICULIER',
    settings,
  });
  assert.equal(res.appliedRule, 'WEEKEND');
  assert.equal(res.unitPrice, 55);
});

test('computeRentalPrice: degressif cumulatif sur 10 jours', () => {
  const res = computeRentalPrice({
    pricing: {
      dailyPrice: 40,
      deposit: 200,
      tiers: [
        { minDays: 1, perDay: 40 },
        { minDays: 4, perDay: 32 },
        { minDays: 8, perDay: 25 },
      ],
    },
    period: { start: '2026-09-01T08:00:00', end: '2026-09-11T08:00:00' },
    quantity: 1,
    customerType: 'PARTICULIER',
    settings,
  });
  // 3*40 + 4*32 + 3*25 = 120 + 128 + 75 = 323
  assert.equal(res.grossUnitPrice, 323);
  assert.equal(res.billedDays, 10);
  assert.ok(res.longDurationDiscount > 0);
});

test('computeRentalPrice: remise PRO 10%', () => {
  const res = computeRentalPrice({
    pricing: { dailyPrice: 40, deposit: 200 },
    period: { start: '2026-09-01T08:00:00', end: '2026-09-04T08:00:00' },
    quantity: 2,
    customerType: 'PRO',
    settings,
  });
  // 3j * 40 = 120 ; -10% = 108 ; x2 = 216
  assert.equal(res.unitPrice, 108);
  assert.equal(res.linePrice, 216);
  assert.equal(res.proDiscount, 12);
});

test('computeCartTotals: TVA 21% et caution hors taxe', () => {
  const t = computeCartTotals({
    rentalLinesHT: [100, 50],
    depositsTotal: 300,
    deliveryFeeHT: 25,
    extraFeesHT: 0,
    discountHT: 15,
    vatRate: 0.21,
  });
  assert.equal(t.totalHT, 160);
  assert.equal(t.vatAmount, 33.6);
  assert.equal(t.totalTVAC, 193.6);
  assert.equal(t.amountDue, 493.6);
});

test('computeLateFee: 26h de retard = 2 jours x 1.5', () => {
  const f = computeLateFee(40, 26, 1.5);
  assert.equal(f.daysLate, 2);
  assert.equal(f.feeHT, 120);
});
