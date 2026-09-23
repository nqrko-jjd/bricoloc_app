'use client';
import { useEffect, useState } from 'react';
import { formatEUR } from '@bricoloc/shared';
import { staffApi } from '@/lib/staff';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface TimeDistanceCfg {
  hourlyRateHT: number;
  perKmHT: number;
  handlingMinutes: number;
  fixedFeeHT: number;
  groupingDiscountPct: number;
  marginPct: number;
  minFeeTVAC: number;
  premiumFeeTVACPerLeg: number;
  maxKmOneWay: number;
  saturdaySurchargeTVAC: number;
  orderCutoffHour: number;
}
interface Delivery {
  depotAddress: string;
  depotLat: number;
  depotLng: number;
  mode: 'BRACKETS' | 'PER_KM' | 'TIME_DISTANCE';
  brackets: { maxKm: number; feeHT: number }[];
  baseFeeHT: number;
  perKmHT: number;
  maxKm: number;
  freeThresholdHT: number;
  saturdaySurchargeHT?: number;
  timeDistance: TimeDistanceCfg;
}

const TD_FIELDS: { key: keyof TimeDistanceCfg; label: string; step?: string }[] = [
  { key: 'hourlyRateHT', label: 'Coût horaire du livreur (€ HT/h)', step: '0.01' },
  { key: 'perKmHT', label: 'Coût du véhicule (€ HT/km)', step: '0.01' },
  { key: 'handlingMinutes', label: 'Manutention livraison + reprise (minutes)' },
  { key: 'fixedFeeHT', label: 'Frais fixes d’organisation par commande (€ HT)', step: '0.01' },
  { key: 'minFeeTVAC', label: 'Minimum facturé livraison + reprise (€ TVAC)', step: '0.01' },
  { key: 'premiumFeeTVACPerLeg', label: 'Supplément premium par passage (€ TVAC)', step: '0.01' },
  { key: 'maxKmOneWay', label: 'Distance maximale aller (km)' },
  { key: 'saturdaySurchargeTVAC', label: 'Supplément samedi (€ TVAC, 0 = aucun)', step: '0.01' },
  { key: 'orderCutoffHour', label: 'Heure limite de commande (0-23, livraison au plus tôt le lendemain)' },
];

export default function AdminZones() {
  const [d, setD] = useState<Delivery | null>(null);
  const [zones, setZones] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [test, setTest] = useState({ line1: '', postalCode: '', city: '' });
  const [testResult, setTestResult] = useState<any>(null);
  const [sim, setSim] = useState({ distanceKm: '10', minutesOneWay: '20', premiumOut: false, premiumReturn: false, isSaturday: false });
  const [simResult, setSimResult] = useState<any>(null);
  const [simBusy, setSimBusy] = useState(false);

  async function load() {
    const [s, z] = await Promise.all([
      staffApi<{ settings: any }>('/api/admin/settings'),
      staffApi<{ zones: any[] }>('/api/admin/delivery-zones'),
    ]);
    setD(s.settings.delivery);
    setZones(z.zones);
  }
  useEffect(() => {
    load();
  }, []);

  async function saveDelivery(next: Delivery) {
    setD(next);
    await staffApi('/api/admin/settings', { method: 'PUT', body: { key: 'delivery', value: next } });
    setMsg('Réglages de livraison enregistrés.');
  }

  async function runSimulation() {
    if (!d) return;
    setSimBusy(true);
    try {
      setSimResult(
        await staffApi('/api/admin/delivery/simulate', {
          method: 'POST',
          body: {
            distanceKm: Number(sim.distanceKm),
            minutesOneWay: Number(sim.minutesOneWay),
            premiumOut: sim.premiumOut,
            premiumReturn: sim.premiumReturn,
            isSaturday: sim.isSaturday,
          },
        }),
      );
    } finally {
      setSimBusy(false);
    }
  }

  if (!d) return <p className="loading-dark"><span className="spinner" /> Chargement…</p>;

  return (
    <div className="stack">
      <h1>Livraison</h1>
      {msg && <div className="alert alert-ok">{msg}</div>}

      <div className="card card-body stack">
        <h3>Tarification géolocalisée</h3>
        <p className="small muted">
          Le tarif se calcule automatiquement depuis l’adresse du client : distance routière
          depuis le dépôt → tarif selon le mode choisi.
        </p>
        <p className="small">
          <strong>Dépôt :</strong> {d.depotAddress} ({d.depotLat.toFixed(4)}, {d.depotLng.toFixed(4)})
        </p>

        <div className="field-2">
          <label className="field small">Mode
            <select value={d.mode} onChange={(e) => saveDelivery({ ...d, mode: e.target.value as any })}>
              <option value="BRACKETS">Tranches de km</option>
              <option value="PER_KM">Au km (forfait + N €/km)</option>
              <option value="TIME_DISTANCE">Forfait calculé selon le temps et la distance</option>
            </select>
          </label>
          {d.mode !== 'TIME_DISTANCE' && (
            <label className="field small">Distance max desservie (km)
              <input type="number" defaultValue={d.maxKm}
                onBlur={(e) => saveDelivery({ ...d, maxKm: Number(e.target.value) })} />
            </label>
          )}
        </div>

        {d.mode === 'BRACKETS' && (
          <div>
            <label className="small" style={{ fontWeight: 700 }}>Tranches</label>
            {d.brackets.map((b, i) => (
              <div key={i} className="row" style={{ margin: '4px 0' }}>
                <span className="small">jusqu’à</span>
                <input type="number" defaultValue={b.maxKm} style={{ width: 70 }}
                  onBlur={(e) => {
                    const br = [...d.brackets];
                    br[i] = { ...b, maxKm: Number(e.target.value) };
                    saveDelivery({ ...d, brackets: br });
                  }} />
                <span className="small">km →</span>
                <input type="number" defaultValue={b.feeHT} style={{ width: 80 }}
                  onBlur={(e) => {
                    const br = [...d.brackets];
                    br[i] = { ...b, feeHT: Number(e.target.value) };
                    saveDelivery({ ...d, brackets: br });
                  }} />
                <span className="small">€ HT</span>
                <button className="btn btn-ghost btn-sm"
                  onClick={() => saveDelivery({ ...d, brackets: d.brackets.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
            <button className="btn btn-outline btn-sm"
              onClick={() => saveDelivery({ ...d, brackets: [...d.brackets, { maxKm: 60, feeHT: 90 }] })}>
              + Tranche
            </button>
          </div>
        )}

        {d.mode === 'PER_KM' && (
          <div className="field-2">
            <label className="field small">Forfait de base (€ HT)
              <input type="number" defaultValue={d.baseFeeHT}
                onBlur={(e) => saveDelivery({ ...d, baseFeeHT: Number(e.target.value) })} />
            </label>
            <label className="field small">Prix au km (€ HT)
              <input type="number" step="0.1" defaultValue={d.perKmHT}
                onBlur={(e) => saveDelivery({ ...d, perKmHT: Number(e.target.value) })} />
            </label>
          </div>
        )}

        {d.mode === 'TIME_DISTANCE' && (
          <div className="stack" style={{ gap: 10 }}>
            <div className="alert alert-info">
              Livraison + reprise facturées <strong>une seule fois</strong> pour la commande, quel
              que soit le nombre de machines ou de jours de location. Le coût horaire, le coût au
              km et l’économie de regroupement sont des <strong>estimations de lancement</strong> —
              à ajuster une fois les premières tournées réelles observées.
            </div>
            <div className="field-3">
              {TD_FIELDS.slice(0, 3).map((f) => (
                <label className="field small" key={f.key}>{f.label}
                  <input type="number" step={f.step} defaultValue={d.timeDistance[f.key]}
                    onBlur={(e) => saveDelivery({ ...d, timeDistance: { ...d.timeDistance, [f.key]: Number(e.target.value) } })} />
                </label>
              ))}
            </div>
            <div className="field-3">
              <label className="field small">Économie de regroupement des tournées (%)
                <input type="number" step="1" defaultValue={Math.round(d.timeDistance.groupingDiscountPct * 100)}
                  onBlur={(e) => saveDelivery({ ...d, timeDistance: { ...d.timeDistance, groupingDiscountPct: Number(e.target.value) / 100 } })} />
                <span className="small muted">S’applique uniquement au coût de route (pas à la manutention ni aux frais fixes).</span>
              </label>
              <label className="field small">Marge souhaitée sur le prix de vente HT (%)
                <input type="number" step="1" defaultValue={Math.round(d.timeDistance.marginPct * 100)}
                  onBlur={(e) => saveDelivery({ ...d, timeDistance: { ...d.timeDistance, marginPct: Number(e.target.value) / 100 } })} />
                <span className="small muted">20 % de marge = coût divisé par 0,80 (pas × 1,20).</span>
              </label>
              {TD_FIELDS.slice(3, 4).map((f) => (
                <label className="field small" key={f.key}>{f.label}
                  <input type="number" step={f.step} defaultValue={d.timeDistance[f.key]}
                    onBlur={(e) => saveDelivery({ ...d, timeDistance: { ...d.timeDistance, [f.key]: Number(e.target.value) } })} />
                </label>
              ))}
            </div>
            <div className="field-3">
              {TD_FIELDS.slice(4, 7).map((f) => (
                <label className="field small" key={f.key}>{f.label}
                  <input type="number" step={f.step} defaultValue={d.timeDistance[f.key]}
                    onBlur={(e) => saveDelivery({ ...d, timeDistance: { ...d.timeDistance, [f.key]: Number(e.target.value) } })} />
                </label>
              ))}
            </div>
            <div className="field-2">
              {TD_FIELDS.slice(7).map((f) => (
                <label className="field small" key={f.key}>{f.label}
                  <input type="number" step={f.step} defaultValue={d.timeDistance[f.key]}
                    onBlur={(e) => saveDelivery({ ...d, timeDistance: { ...d.timeDistance, [f.key]: Number(e.target.value) } })} />
                </label>
              ))}
            </div>
          </div>
        )}

        {d.mode !== 'TIME_DISTANCE' && (
          <>
            <label className="field small">Livraison offerte au-delà de (€ HT de location, 0 = jamais)
              <input type="number" defaultValue={d.freeThresholdHT}
                onBlur={(e) => saveDelivery({ ...d, freeThresholdHT: Number(e.target.value) })} />
            </label>

            <label className="field small">Supplément livraison le samedi (€ HT, 0 = aucun)
              <input type="number" defaultValue={d.saturdaySurchargeHT ?? 0}
                onBlur={(e) => saveDelivery({ ...d, saturdaySurchargeHT: Number(e.target.value) })} />
              <span className="small muted">S'ajoute même si la livraison est offerte (franchise). Ne concerne pas l'enlèvement au dépôt.</span>
            </label>
          </>
        )}
      </div>

      {d.mode === 'TIME_DISTANCE' && (
        <div className="card card-body stack">
          <h3>Simulateur</h3>
          <p className="small muted">
            Distance et temps ALLER simple (comme calculés en production depuis l’adresse client) →
            décomposition complète du calcul et prix client.
          </p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
            <label className="field small">Distance aller (km)
              <input type="number" step="0.1" value={sim.distanceKm} style={{ width: 90 }}
                onChange={(e) => setSim({ ...sim, distanceKm: e.target.value })} />
            </label>
            <label className="field small">Temps aller (min)
              <input type="number" value={sim.minutesOneWay} style={{ width: 90 }}
                onChange={(e) => setSim({ ...sim, minutesOneWay: e.target.value })} />
            </label>
            <label className="row small" style={{ alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={sim.premiumOut} onChange={(e) => setSim({ ...sim, premiumOut: e.target.checked })} />
              Premium aller
            </label>
            <label className="row small" style={{ alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={sim.premiumReturn} onChange={(e) => setSim({ ...sim, premiumReturn: e.target.checked })} />
              Premium retour
            </label>
            <label className="row small" style={{ alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={sim.isSaturday} onChange={(e) => setSim({ ...sim, isSaturday: e.target.checked })} />
              Samedi
            </label>
            <button className="btn btn-primary btn-sm" disabled={simBusy} onClick={runSimulation}>
              {simBusy ? '…' : 'Calculer'}
            </button>
          </div>
          {simResult?.breakdown && (
            <table className="table" style={{ marginTop: 8 }}>
              <tbody>
                <tr><td>Distance aller</td><td>{simResult.breakdown.distanceKmOneWay} km</td></tr>
                <tr><td>Temps aller</td><td>{simResult.breakdown.minutesOneWay} min</td></tr>
                <tr><td>Coût de route (après regroupement)</td><td>{formatEUR(simResult.breakdown.routeCostHT)} HT</td></tr>
                <tr><td>Coût fixe (manutention + frais fixes)</td><td>{formatEUR(simResult.breakdown.fixedCostHT)} HT</td></tr>
                <tr><td>Coût total estimé</td><td>{formatEUR(simResult.breakdown.totalCostHT)} HT</td></tr>
                <tr><td>Prix standard</td><td>{formatEUR(simResult.breakdown.standardPriceHT)} HT</td></tr>
                <tr style={{ fontWeight: 700 }}>
                  <td>Prix client{simResult.breakdown.minApplied ? ' (minimum appliqué)' : ''}</td>
                  <td>{formatEUR(simResult.breakdown.finalPriceTVAC)} TVAC</td>
                </tr>
                {simResult.breakdown.outOfRange && (
                  <tr><td colSpan={2} className="small" style={{ color: 'var(--err)' }}>Hors zone — transport sur devis.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Test rapide (modes classiques) */}
      {d.mode !== 'TIME_DISTANCE' && (
        <div className="card card-body">
          <h3>Tester une adresse</h3>
          <div className="row">
            <input placeholder="Rue et n°" value={test.line1} onChange={(e) => setTest({ ...test, line1: e.target.value })} style={{ flex: 1 }} />
            <input placeholder="CP" value={test.postalCode} onChange={(e) => setTest({ ...test, postalCode: e.target.value })} style={{ width: 70 }} />
            <input placeholder="Ville" value={test.city} onChange={(e) => setTest({ ...test, city: e.target.value })} style={{ width: 130 }} />
            <button className="btn btn-primary btn-sm"
              onClick={async () => setTestResult(await staffApi('/api/admin/delivery/test', { method: 'POST', body: { ...test, country: 'BE' } }))}>
              Calculer
            </button>
          </div>
          {testResult && (
            <div className={`alert ${testResult.served ? (testResult.free ? 'alert-ok' : 'alert-info') : 'alert-warn'}`} style={{ marginTop: 10 }}>
              {testResult.geocoded ? (
                testResult.served
                  ? testResult.free
                    ? `Livraison offerte — ${testResult.distanceKm} km`
                    : `${formatEUR(testResult.feeHT)} HT — ${testResult.distanceKm} km depuis le dépôt`
                  : `Hors zone (${testResult.distanceKm} km > ${d.maxKm} km)`
              ) : 'Adresse non localisée'}
            </div>
          )}
        </div>
      )}

      {/* Zones héritées (préfixe CP) */}
      <div className="card card-body table-wrap">
        <h3>Zones par code postal (secours)</h3>
        <p className="small muted">
          {d.mode === 'TIME_DISTANCE'
            ? 'Désactivées pour ce mode — la distance maximale aller ci-dessus fait foi.'
            : 'Optionnel — utilisées seulement si le géocodage échoue.'}
        </p>
        <table className="table">
          <thead>
            <tr><th>Nom</th><th>Préfixes</th><th>Frais</th><th>Actif</th><th></th></tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id}>
                <td>{z.name}</td>
                <td className="small">{(z.postalPrefixes as string[]).join(', ')}</td>
                <td>{formatEUR(z.baseFee)}</td>
                <td>
                  <input type="checkbox" defaultChecked={z.active}
                    onChange={async (e) => { await staffApi(`/api/admin/delivery-zones/${z.id}`, { method: 'PATCH', body: { active: e.target.checked } }); load(); }} />
                </td>
                <td>
                  <button className="btn btn-ghost btn-sm"
                    onClick={async () => { await staffApi(`/api/admin/delivery-zones/${z.id}`, { method: 'DELETE' }); load(); }}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
