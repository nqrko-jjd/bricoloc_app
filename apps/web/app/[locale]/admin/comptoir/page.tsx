'use client';
import { useState } from 'react';
import { formatEUR, formatDateTimeBE } from '@bricoloc/shared';
import { staffApi } from '@/lib/staff';
import { StatusBadge } from '@/components/StatusBadge';
import { toLocalInput, fromLocalInput } from '@/lib/dates';

interface ScanResult {
  reservation: {
    id: string;
    number: string;
    status: string;
    periodStart: string;
    periodEnd: string;
    fulfilmentMode: string;
    user: { firstName: string; lastName: string; phone: string } | null;
    contact: { firstName?: string; lastName?: string } | null;
    items: {
      id: string;
      productId: string;
      kind: string;
      quantity: number;
      nameSnapshot: string;
      product: { units: { id: string; assetTag: string; state: string }[] };
    }[];
    deposit: { amount: number; status: string } | null;
  };
  paid: boolean;
  depositHeld: boolean;
}

export default function ComptoirPage() {
  const [token, setToken] = useState('');
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<string>('');

  // pickup state
  const [pickedUnits, setPickedUnits] = useState<Record<string, boolean>>({});
  const [pickChecklist, setPickChecklist] = useState({
    etat_general: false,
    accessoires_complets: false,
    carburant_plein: false,
    notice_remise: false,
  });
  const [signature, setSignature] = useState('');

  // return state
  const [returnAt, setReturnAt] = useState('');
  const [retChecklist, setRetChecklist] = useState({ nettoye: false, complet: false, fonctionnel: false });
  const [cleaningFee, setCleaningFee] = useState(0);
  const [otherFee, setOtherFee] = useState(0);
  const [otherReason, setOtherReason] = useState('');
  const [damages, setDamages] = useState<{ unitId: string; description: string; feeHT: number }[]>([]);
  const [depositAction, setDepositAction] = useState<'RELEASE' | 'PARTIAL' | 'CAPTURE'>('RELEASE');
  const [depositCaptured, setDepositCaptured] = useState(0);

  async function doScan(e?: React.FormEvent) {
    e?.preventDefault();
    setErr('');
    setResult('');
    setScan(null);
    try {
      const r = await staffApi<ScanResult>(`/api/ops/scan/${encodeURIComponent(token.trim())}`);
      setScan(r);
      setReturnAt(toLocalInput(new Date().toISOString()));
      const preset: Record<string, boolean> = {};
      r.reservation.items
        .filter((i) => i.kind === 'MACHINE')
        .forEach((i) => {
          i.product.units
            .filter((u) => u.state === 'AVAILABLE')
            .slice(0, i.quantity)
            .forEach((u) => (preset[u.id] = true));
        });
      setPickedUnits(preset);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Réservation introuvable');
    }
  }

  async function setStatus(status: string) {
    if (!scan) return;
    await staffApi(`/api/ops/reservations/${scan.reservation.id}/status`, {
      method: 'POST',
      body: { status },
    });
    await doScan();
  }

  async function doPickup() {
    if (!scan) return;
    setErr('');
    try {
      const unitIds = Object.entries(pickedUnits)
        .filter(([, v]) => v)
        .map(([k]) => k);
      await staffApi('/api/ops/pickup', {
        method: 'POST',
        body: {
          reservationId: scan.reservation.id,
          unitIds,
          checklist: pickChecklist,
          photos: [],
          customerSignature: signature || 'data:image/png;base64,SIGNATURE',
          note: '',
        },
      });
      setResult('Location activée. Le matériel est officiellement sorti.');
      await doScan();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur au retrait');
    }
  }

  async function doReturn() {
    if (!scan) return;
    setErr('');
    try {
      const r = await staffApi<{
        lateFeeHT: number;
        lateDays: number;
        extraChargesHT: number;
        deposit: { refunded: number; captured: number; status: string };
        finalInvoice: string;
      }>('/api/ops/return', {
        method: 'POST',
        body: {
          reservationId: scan.reservation.id,
          actualReturnAt: fromLocalInput(returnAt),
          checklist: retChecklist,
          photos: [],
          damages,
          missingAccessories: [],
          cleaningFeeHT: cleaningFee,
          otherFeeHT: otherFee,
          otherFeeReason: otherReason,
          depositAction,
          depositCapturedAmount: depositCaptured,
        },
      });
      setResult(
        `Retour clôturé. Retard : ${r.lateDays} j (${formatEUR(r.lateFeeHT)}). ` +
          `Frais supplémentaires : ${formatEUR(r.extraChargesHT)}. ` +
          `Caution ${r.deposit.status} — remboursé ${formatEUR(r.deposit.refunded)}, retenu ${formatEUR(r.deposit.captured)}. ` +
          `Facture finale : ${r.finalInvoice}.`,
      );
      await doScan();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur au retour');
    }
  }

  const r = scan?.reservation;
  const canPickup = r && ['CONFIRMED', 'PREPARING', 'READY'].includes(r.status);
  const canReturn = r && ['OUT', 'RETURN_PENDING'].includes(r.status);

  return (
    <div className="stack">
      <h1>Comptoir — retrait &amp; retour</h1>
      <form className="card card-pad row" onSubmit={doScan}>
        <div className="field" style={{ flex: 1 }}>
          <label>Scanner / saisir le QR code ou le numéro de réservation</label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="R-XXXXXXXX ou BRL-20260901-0001"
            autoFocus
          />
        </div>
        <button className="btn btn-primary">Rechercher</button>
      </form>

      {err && <div className="alert alert-err">{err}</div>}
      {result && <div className="alert alert-ok">{result}</div>}

      {r && (
        <div className="card card-pad stack">
          <div className="spread">
            <h2>
              {r.number} <StatusBadge status={r.status} />
            </h2>
            <div className="pill-row">
              <span className={`badge ${scan!.paid ? 'badge-ok' : 'badge-err'}`}>
                {scan!.paid ? 'Payé' : 'Non payé'}
              </span>
              <span className={`badge ${scan!.depositHeld ? 'badge-ok' : 'badge-warn'}`}>
                Caution {r.deposit ? formatEUR(r.deposit.amount) : '—'} · {r.deposit?.status}
              </span>
            </div>
          </div>
          <p className="small muted">
            {r.user
              ? `${r.user.firstName} ${r.user.lastName} · ${r.user.phone}`
              : `${r.contact?.firstName ?? ''} ${r.contact?.lastName ?? ''} (invité)`}{' '}
            — {r.fulfilmentMode === 'DELIVERY' ? 'Livraison' : 'Retrait comptoir'} —{' '}
            {formatDateTimeBE(r.periodStart)} → {formatDateTimeBE(r.periodEnd)}
          </p>

          {r.status === 'CONFIRMED' && (
            <button className="btn btn-outline btn-sm" onClick={() => setStatus('PREPARING')}>
              Démarrer la préparation
            </button>
          )}
          {r.status === 'PREPARING' && (
            <button className="btn btn-outline btn-sm" onClick={() => setStatus('READY')}>
              Marquer « prêt » (notifie le client)
            </button>
          )}

          {canPickup && (
            <div className="stack">
              <h3>Retrait — affectation des exemplaires</h3>
              {r.items
                .filter((i) => i.kind === 'MACHINE')
                .map((i) => (
                  <div key={i.id} className="card card-body" style={{ boxShadow: 'none' }}>
                    <strong>
                      {i.quantity}× {i.nameSnapshot}
                    </strong>
                    <div className="pill-row" style={{ marginTop: 6 }}>
                      {i.product.units.map((u) => (
                        <label
                          key={u.id}
                          className="chip"
                          style={{ cursor: u.state === 'AVAILABLE' ? 'pointer' : 'not-allowed', opacity: u.state === 'AVAILABLE' ? 1 : 0.5 }}
                        >
                          <input
                            type="checkbox"
                            disabled={u.state !== 'AVAILABLE'}
                            checked={!!pickedUnits[u.id]}
                            onChange={(e) =>
                              setPickedUnits((s) => ({ ...s, [u.id]: e.target.checked }))
                            }
                          />{' '}
                          {u.assetTag} ({u.state})
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              <div className="card card-body" style={{ boxShadow: 'none' }}>
                <strong>Checklist de sortie</strong>
                {Object.entries(pickChecklist).map(([k, v]) => (
                  <label key={k} className="row" style={{ gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={v}
                      onChange={(e) =>
                        setPickChecklist((s) => ({ ...s, [k]: e.target.checked }))
                      }
                    />
                    <span className="small">{k.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
              <div className="field">
                <label>Signature du client (nom ou trait)</label>
                <input value={signature} onChange={(e) => setSignature(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={doPickup} disabled={!scan!.paid}>
                Valider le retrait &amp; lancer la location
              </button>
            </div>
          )}

          {canReturn && (
            <div className="stack">
              <h3>Retour — contrôle du matériel</h3>
              <div className="field">
                <label>Heure réelle de retour</label>
                <input
                  type="datetime-local"
                  value={returnAt}
                  onChange={(e) => setReturnAt(e.target.value)}
                />
              </div>
              <div className="card card-body" style={{ boxShadow: 'none' }}>
                <strong>Checklist</strong>
                {Object.entries(retChecklist).map(([k, v]) => (
                  <label key={k} className="row" style={{ gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={v}
                      onChange={(e) => setRetChecklist((s) => ({ ...s, [k]: e.target.checked }))}
                    />
                    <span className="small">{k}</span>
                  </label>
                ))}
              </div>
              <div className="field-2">
                <div className="field">
                  <label>Frais de nettoyage HTVA</label>
                  <input
                    type="number"
                    value={cleaningFee}
                    onChange={(e) => setCleaningFee(Number(e.target.value))}
                  />
                </div>
                <div className="field">
                  <label>Autres frais HTVA</label>
                  <input
                    type="number"
                    value={otherFee}
                    onChange={(e) => setOtherFee(Number(e.target.value))}
                  />
                </div>
              </div>
              {otherFee > 0 && (
                <div className="field">
                  <label>Motif des autres frais</label>
                  <input value={otherReason} onChange={(e) => setOtherReason(e.target.value)} />
                </div>
              )}

              <div className="card card-body" style={{ boxShadow: 'none' }}>
                <div className="spread">
                  <strong>Dommages</strong>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      setDamages((s) => [
                        ...s,
                        {
                          unitId:
                            r.items.flatMap((i) => i.product.units)[0]?.id ?? '',
                          description: '',
                          feeHT: 0,
                        },
                      ])
                    }
                  >
                    + Ajouter
                  </button>
                </div>
                {damages.map((d, idx) => (
                  <div key={idx} className="row" style={{ marginTop: 6 }}>
                    <select
                      value={d.unitId}
                      onChange={(e) =>
                        setDamages((s) =>
                          s.map((x, i) => (i === idx ? { ...x, unitId: e.target.value } : x)),
                        )
                      }
                    >
                      {r.items
                        .flatMap((i) => i.product.units)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.assetTag}
                          </option>
                        ))}
                    </select>
                    <input
                      placeholder="Description"
                      value={d.description}
                      onChange={(e) =>
                        setDamages((s) =>
                          s.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)),
                        )
                      }
                    />
                    <input
                      type="number"
                      placeholder="€ HT"
                      style={{ width: 90 }}
                      value={d.feeHT}
                      onChange={(e) =>
                        setDamages((s) =>
                          s.map((x, i) =>
                            i === idx ? { ...x, feeHT: Number(e.target.value) } : x,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="field">
                <label>Caution</label>
                <select
                  value={depositAction}
                  onChange={(e) => setDepositAction(e.target.value as typeof depositAction)}
                >
                  <option value="RELEASE">Libérer entièrement</option>
                  <option value="PARTIAL">Retenir une partie</option>
                  <option value="CAPTURE">Retenir la totalité</option>
                </select>
              </div>
              {depositAction === 'PARTIAL' && (
                <div className="field">
                  <label>Montant retenu</label>
                  <input
                    type="number"
                    value={depositCaptured}
                    onChange={(e) => setDepositCaptured(Number(e.target.value))}
                  />
                </div>
              )}
              <button className="btn btn-primary" onClick={doReturn}>
                Clôturer le retour &amp; émettre la facture finale
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
