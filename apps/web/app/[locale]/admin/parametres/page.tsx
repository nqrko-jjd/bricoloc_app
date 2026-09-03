'use client';
import { useEffect, useState } from 'react';
import { staffApi } from '@/lib/staff';

/* eslint-disable @typescript-eslint/no-explicit-any */
const NUMERIC = [
  ['vatRate', 'Taux de TVA (0-1)'],
  ['minLeadTimeHours', 'Délai mini avant retrait (h)'],
  ['sameDayCutoffHour', 'Heure limite retour “même jour”'],
  ['lateFeeMultiplier', 'Multiplicateur frais de retard'],
  ['deliveryBaseFee', 'Frais de livraison de base'],
  ['deliveryFreeThreshold', 'Livraison offerte dès (HTVA)'],
  ['cleaningFeeDefault', 'Frais de nettoyage par défaut'],
  ['proDiscountPctDefault', 'Remise PRO par défaut (0-1)'],
];

export default function AdminParametres() {
  const [s, setS] = useState<any>(null);
  const [company, setCompany] = useState<any>({});
  const [loiselet, setLoiselet] = useState<any>({});
  const [points, setPoints] = useState<any[]>([]);
  const [composed, setComposed] = useState<{ enabled: boolean; tiers: { minMachines: number; pct: number }[] }>({
    enabled: true,
    tiers: [],
  });
  const [msg, setMsg] = useState('');

  const load = () =>
    staffApi<{ settings: any }>('/api/admin/settings').then((r) => {
      setS(r.settings);
      setCompany(r.settings.company ?? {});
      setLoiselet(r.settings.loiselet ?? {});
      setPoints(Array.isArray(r.settings.pickupPoints) ? r.settings.pickupPoints : []);
      const cp = r.settings.composedPack ?? {};
      setComposed({
        enabled: cp.enabled !== false,
        tiers: Array.isArray(cp.tiers) ? cp.tiers : [],
      });
    });
  useEffect(() => {
    load();
  }, []);
  if (!s) return <p>Chargement…</p>;

  async function save(key: string, value: any) {
    await staffApi('/api/admin/settings', { method: 'PUT', body: { key, value } });
    setMsg(`« ${key} » enregistré.`);
    await load();
  }

  return (
    <div className="stack">
      <h1>Paramètres</h1>
      {msg && <div className="alert alert-ok">{msg}</div>}
      <div className="card card-pad">
        <h3>Paramètres économiques</h3>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {NUMERIC.map(([key, label]) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input
                type="number"
                step="0.01"
                defaultValue={s[key]}
                onBlur={(e) => save(key, Number(e.target.value))}
              />
            </div>
          ))}
        </div>
        <label className="row" style={{ gap: 8, marginTop: 10 }}>
          <input
            type="checkbox"
            defaultChecked={!!s.weekendRuleEnabled}
            onChange={(e) => save('weekendRuleEnabled', e.target.checked)}
          />
          <span className="small">Règle week-end (vendredi → lundi = 1 jour)</span>
        </label>
      </div>

      <div className="card card-pad stack">
        <h3>Pack composé — remise multi-machines</h3>
        <p className="small muted">
          Remise automatique selon le nombre de machines dans le panier (même 1 jour). Ne compte
          pas les BricoPacks curatés ni les machines Loiselet. Cumulable avec la remise Pro ; les
          BricoPacks curatés restent plus avantageux.
        </p>
        <label className="row" style={{ gap: 8 }}>
          <input
            type="checkbox"
            checked={composed.enabled}
            onChange={(e) => {
              const next = { ...composed, enabled: e.target.checked };
              setComposed(next);
              save('composedPack', next);
            }}
          />
          <span className="small">Activer le pack composé</span>
        </label>
        <table className="table" style={{ maxWidth: 420 }}>
          <thead>
            <tr>
              <th>À partir de (machines)</th>
              <th>Remise (%)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {composed.tiers.map((t, i) => (
              <tr key={i}>
                <td>
                  <input
                    type="number"
                    min={2}
                    style={{ width: 80 }}
                    defaultValue={t.minMachines}
                    onBlur={(e) => {
                      const tiers = composed.tiers.map((x, j) =>
                        j === i ? { ...x, minMachines: Number(e.target.value) } : x,
                      );
                      const next = { ...composed, tiers };
                      setComposed(next);
                      save('composedPack', next);
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step={1}
                    style={{ width: 80 }}
                    defaultValue={Math.round(t.pct * 100)}
                    onBlur={(e) => {
                      const tiers = composed.tiers.map((x, j) =>
                        j === i ? { ...x, pct: Number(e.target.value) / 100 } : x,
                      );
                      const next = { ...composed, tiers };
                      setComposed(next);
                      save('composedPack', next);
                    }}
                  />
                </td>
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const next = { ...composed, tiers: composed.tiers.filter((_, j) => j !== i) };
                      setComposed(next);
                      save('composedPack', next);
                    }}
                  >
                    Retirer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => {
            const last = composed.tiers[composed.tiers.length - 1];
            const next = {
              ...composed,
              tiers: [
                ...composed.tiers,
                { minMachines: (last?.minMachines ?? 2) + 1, pct: (last?.pct ?? 0.05) + 0.03 },
              ],
            };
            setComposed(next);
            save('composedPack', next);
          }}
        >
          + Ajouter un palier
        </button>
      </div>

      <div className="card card-pad">
        <h3>Coordonnées de la société</h3>
        <p className="small muted">Actuellement fictives (démo) — à compléter.</p>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {['legalName', 'vatNumber', 'address', 'phone', 'email', 'iban'].map((k) => (
            <div className="field" key={k}>
              <label>{k}</label>
              <input
                value={company[k] ?? ''}
                onChange={(e) => setCompany({ ...company, [k]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <button
          className="btn btn-primary btn-sm"
          style={{ marginTop: 10 }}
          onClick={() => save('company', company)}
        >
          Enregistrer les coordonnées
        </button>
      </div>

      <div className="card card-pad">
        <h3>Points d’enlèvement (Click &amp; Collect)</h3>
        <p className="small muted">
          Le stock reste au dépôt principal. Un « point relais » implique un délai
          d’acheminement (heures) avant que la commande y soit disponible.
        </p>
        {points.map((p, i) => (
          <div key={p.id ?? i} className="card card-body" style={{ marginTop: 10 }}>
            <div className="field-2">
              <div className="field">
                <label>Nom</label>
                <input
                  defaultValue={p.name}
                  onBlur={(e) => {
                    const next = points.map((x, j) => (j === i ? { ...x, name: e.target.value } : x));
                    setPoints(next);
                    save('pickupPoints', next);
                  }}
                />
              </div>
              <div className="field">
                <label>Rue et numéro</label>
                <input
                  defaultValue={p.line1}
                  onBlur={(e) => {
                    const next = points.map((x, j) => (j === i ? { ...x, line1: e.target.value } : x));
                    setPoints(next);
                    save('pickupPoints', next);
                  }}
                />
              </div>
            </div>
            <div className="field-2">
              <div className="field">
                <label>Code postal</label>
                <input
                  defaultValue={p.postalCode}
                  onBlur={(e) => {
                    const next = points.map((x, j) => (j === i ? { ...x, postalCode: e.target.value } : x));
                    setPoints(next);
                    save('pickupPoints', next);
                  }}
                />
              </div>
              <div className="field">
                <label>Ville</label>
                <input
                  defaultValue={p.city}
                  onBlur={(e) => {
                    const next = points.map((x, j) => (j === i ? { ...x, city: e.target.value } : x));
                    setPoints(next);
                    save('pickupPoints', next);
                  }}
                />
              </div>
            </div>
            <div className="field-2">
              <div className="field">
                <label>Horaires</label>
                <input
                  defaultValue={p.hours}
                  placeholder="Lun–Sam 8h–17h"
                  onBlur={(e) => {
                    const next = points.map((x, j) => (j === i ? { ...x, hours: e.target.value } : x));
                    setPoints(next);
                    save('pickupPoints', next);
                  }}
                />
              </div>
              <div className="field">
                <label>Délai d’acheminement (h)</label>
                <input
                  type="number"
                  defaultValue={p.transferHours ?? 0}
                  disabled={p.isMain}
                  onBlur={(e) => {
                    const next = points.map((x, j) =>
                      j === i ? { ...x, transferHours: Number(e.target.value) || 0 } : x,
                    );
                    setPoints(next);
                    save('pickupPoints', next);
                  }}
                />
              </div>
            </div>
            <div className="row" style={{ gap: 12, alignItems: 'center' }}>
              <label className="row" style={{ gap: 6 }}>
                <input
                  type="checkbox"
                  defaultChecked={p.active !== false}
                  onChange={(e) => {
                    const next = points.map((x, j) => (j === i ? { ...x, active: e.target.checked } : x));
                    setPoints(next);
                    save('pickupPoints', next);
                  }}
                />
                <span className="small">Actif (visible des clients)</span>
              </label>
              {p.isMain ? (
                <span className="badge">Principal</span>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const next = points.filter((_, j) => j !== i);
                    setPoints(next);
                    save('pickupPoints', next);
                  }}
                >
                  Supprimer
                </button>
              )}
            </div>
          </div>
        ))}
        <button
          className="btn btn-outline btn-sm"
          style={{ marginTop: 10 }}
          onClick={() => {
            const next = [
              ...points,
              {
                id: `relais-${Date.now().toString(36)}`,
                name: 'Nouveau point relais',
                line1: '',
                postalCode: '',
                city: '',
                hours: '',
                lat: null,
                lng: null,
                isMain: false,
                transferHours: 24,
                active: false,
              },
            ];
            setPoints(next);
            save('pickupPoints', next);
          }}
        >
          + Ajouter un point relais
        </button>
      </div>

      <div className="card card-pad">
        <h3>Partenaire Loiselet</h3>
        <p className="small muted">
          Destinataires des demandes de location envoyées à Loiselet (grosses machines / pros).
          Une adresse par ligne — toutes sont pré-cochées à l&apos;envoi, décochables au cas par cas.
        </p>
        <div className="field">
          <label>Adresses e-mail Loiselet</label>
          <textarea
            rows={3}
            defaultValue={(loiselet.recipients ?? []).join('\n')}
            onBlur={(e) =>
              save('loiselet', {
                ...loiselet,
                recipients: e.target.value
                  .split(/[\n,;]+/)
                  .map((x: string) => x.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="field">
            <label>Copie interne Bricoloc (optionnel)</label>
            <input
              defaultValue={loiselet.ccBricoloc ?? ''}
              placeholder="ex : achats@bricoloc.be"
              onBlur={(e) => save('loiselet', { ...loiselet, ccBricoloc: e.target.value.trim() })}
            />
          </div>
          <div className="field">
            <label>Marge Bricoloc sur le prix affiché (0-1)</label>
            <input
              type="number"
              step="0.01"
              defaultValue={loiselet.marginPct ?? 0.25}
              onBlur={(e) => save('loiselet', { ...loiselet, marginPct: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
