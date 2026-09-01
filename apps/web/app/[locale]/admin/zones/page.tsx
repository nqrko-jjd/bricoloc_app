'use client';
import { useEffect, useState } from 'react';
import { formatEUR } from '@bricoloc/shared';
import { staffApi } from '@/lib/staff';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Delivery {
  depotAddress: string;
  depotLat: number;
  depotLng: number;
  mode: 'BRACKETS' | 'PER_KM';
  brackets: { maxKm: number; feeHT: number }[];
  baseFeeHT: number;
  perKmHT: number;
  maxKm: number;
  freeThresholdHT: number;
}

export default function AdminZones() {
  const [d, setD] = useState<Delivery | null>(null);
  const [zones, setZones] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [test, setTest] = useState({ line1: '', postalCode: '', city: '' });
  const [testResult, setTestResult] = useState<any>(null);

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

  if (!d) return <p className="loading-dark"><span className="spinner" /> Chargement…</p>;

  return (
    <div className="stack">
      <h1>Livraison</h1>
      {msg && <div className="alert alert-ok">{msg}</div>}

      <div className="card card-body stack">
        <h3>Tarification géolocalisée</h3>
        <p className="small muted">
          Le tarif se calcule automatiquement depuis l’adresse du client : distance routière
          depuis le dépôt → tranche de km ou prix au km.
        </p>
        <p className="small">
          <strong>Dépôt :</strong> {d.depotAddress} ({d.depotLat.toFixed(4)}, {d.depotLng.toFixed(4)})
        </p>

        <div className="field-2">
          <label className="field small">Mode
            <select value={d.mode} onChange={(e) => saveDelivery({ ...d, mode: e.target.value as any })}>
              <option value="BRACKETS">Tranches de km</option>
              <option value="PER_KM">Au km (forfait + N €/km)</option>
            </select>
          </label>
          <label className="field small">Distance max desservie (km)
            <input type="number" defaultValue={d.maxKm}
              onBlur={(e) => saveDelivery({ ...d, maxKm: Number(e.target.value) })} />
          </label>
        </div>

        {d.mode === 'BRACKETS' ? (
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
        ) : (
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

        <label className="field small">Livraison offerte au-delà de (€ HT de location, 0 = jamais)
          <input type="number" defaultValue={d.freeThresholdHT}
            onBlur={(e) => saveDelivery({ ...d, freeThresholdHT: Number(e.target.value) })} />
        </label>
      </div>

      {/* Test rapide */}
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

      {/* Zones héritées (préfixe CP) */}
      <div className="card card-body table-wrap">
        <h3>Zones par code postal (secours)</h3>
        <p className="small muted">Optionnel — utilisées seulement si le géocodage échoue.</p>
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
