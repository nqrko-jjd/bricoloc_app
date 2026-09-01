import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDeliveryFee, haversineKm, type DeliveryConfig } from '../src/pricing.js';

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
