import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDeliveryFee,
  computeTimeDistanceDelivery,
  haversineKm,
  type DeliveryConfig,
  type TimeDistanceDeliveryConfig,
} from '../src/pricing.js';

const CFG: DeliveryConfig = {
  mode: 'BRACKETS',
  brackets: [
    { maxKm: 15, feeHT: 25 },
    { maxKm: 30, feeHT: 40 },
    { maxKm: 50, feeHT: 65 },
  ],
  baseFeeHT: 20,
  perKmHT: 1.2,
  maxKm: 50,
  freeThresholdHT: 350,
};

test('tranches de km : la bonne tranche est appliquée', () => {
  assert.equal(computeDeliveryFee(9.7, CFG).feeHT, 25);
  assert.equal(computeDeliveryFee(15, CFG).feeHT, 25);
  assert.equal(computeDeliveryFee(21.9, CFG).feeHT, 40);
  assert.equal(computeDeliveryFee(45, CFG).feeHT, 65);
});

test('au-delà de maxKm : non desservi', () => {
  const q = computeDeliveryFee(80, CFG);
  assert.equal(q.served, false);
  assert.equal(q.reason, 'OUT_OF_RANGE');
});

test('franchise : livraison offerte au-delà du seuil', () => {
  const q = computeDeliveryFee(21.9, CFG, 400);
  assert.equal(q.free, true);
  assert.equal(q.feeHT, 0);
  assert.equal(q.served, true);
});

test('mode au km : base + N €/km', () => {
  const perKm: DeliveryConfig = { ...CFG, mode: 'PER_KM' };
  assert.equal(computeDeliveryFee(10, perKm).feeHT, 32); // 20 + 10*1.2
});

test('haversine : distance plausible Ruisbroek -> Overijse', () => {
  const km = haversineKm({ lat: 50.7921, lng: 4.2967 }, { lat: 50.7739, lng: 4.5347 });
  assert.ok(km > 14 && km < 22, `distance ${km}`);
});

/* --------------- TIME_DISTANCE : verification du cahier des charges --------------- */

const TD: TimeDistanceDeliveryConfig = {
  hourlyRateHT: 12.5,
  perKmHT: 0.4,
  handlingMinutes: 30,
  fixedFeeHT: 3.75,
  groupingDiscountPct: 0.3,
  marginPct: 0.2,
  minFeeTVAC: 39,
  premiumFeeTVACPerLeg: 25,
  maxKmOneWay: 50,
  saturdaySurchargeTVAC: 0,
};
const VAT = 0.21;
const base = { premiumOut: false, premiumReturn: false };

test('TIME_DISTANCE — 10 km / 20 min -> 49,71 € TVAC (tableau de verification)', () => {
  const b = computeTimeDistanceDelivery({ distanceKmOneWay: 10, minutesOneWay: 20, ...base }, TD, VAT);
  assert.equal(b.finalPriceTVAC, 49.71);
  assert.equal(b.minApplied, false);
  assert.equal(b.outOfRange, false);
});

test('TIME_DISTANCE — 10 km / 30 min -> 58,54 € TVAC (tableau de verification)', () => {
  const b = computeTimeDistanceDelivery({ distanceKmOneWay: 10, minutesOneWay: 30, ...base }, TD, VAT);
  assert.equal(b.finalPriceTVAC, 58.54);
});

test('TIME_DISTANCE — 10 km / 20 min, regroupement desactive -> 64,53 € TVAC (tableau de verification)', () => {
  const cfg: TimeDistanceDeliveryConfig = { ...TD, groupingDiscountPct: 0 };
  const b = computeTimeDistanceDelivery({ distanceKmOneWay: 10, minutesOneWay: 20, ...base }, cfg, VAT);
  assert.equal(b.finalPriceTVAC, 64.53);
});

test('TIME_DISTANCE — trajet tres court -> minimum de 39 € TVAC applique', () => {
  const b = computeTimeDistanceDelivery({ distanceKmOneWay: 1, minutesOneWay: 5, ...base }, TD, VAT);
  assert.equal(b.finalPriceTVAC, 39);
  assert.equal(b.minApplied, true);
});

test('TIME_DISTANCE — supplements premium independants (aller seul, retour seul, les deux)', () => {
  const std = computeTimeDistanceDelivery({ distanceKmOneWay: 10, minutesOneWay: 20, ...base }, TD, VAT);
  const out = computeTimeDistanceDelivery({ distanceKmOneWay: 10, minutesOneWay: 20, premiumOut: true, premiumReturn: false }, TD, VAT);
  const ret = computeTimeDistanceDelivery({ distanceKmOneWay: 10, minutesOneWay: 20, premiumOut: false, premiumReturn: true }, TD, VAT);
  const both = computeTimeDistanceDelivery({ distanceKmOneWay: 10, minutesOneWay: 20, premiumOut: true, premiumReturn: true }, TD, VAT);
  assert.equal(round(out.finalPriceTVAC - std.finalPriceTVAC), 25);
  assert.equal(round(ret.finalPriceTVAC - std.finalPriceTVAC), 25);
  assert.equal(round(both.finalPriceTVAC - std.finalPriceTVAC), 50);
});

test('TIME_DISTANCE — au-dela de la distance max : hors zone, aucun prix automatique', () => {
  const b = computeTimeDistanceDelivery({ distanceKmOneWay: 51, minutesOneWay: 60, ...base }, TD, VAT);
  assert.equal(b.outOfRange, true);
  assert.equal(b.finalPriceTVAC, 0);
});

test('TIME_DISTANCE — supplement samedi ajoute apres le minimum', () => {
  const cfg: TimeDistanceDeliveryConfig = { ...TD, saturdaySurchargeTVAC: 10 };
  const b = computeTimeDistanceDelivery({ distanceKmOneWay: 10, minutesOneWay: 20, ...base, isSaturday: true }, cfg, VAT);
  assert.equal(b.finalPriceTVAC, 59.71); // 49.71 + 10
});

function round(n: number) {
  return Math.round(n * 100) / 100;
}
