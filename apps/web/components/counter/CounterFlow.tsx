'use client';

import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { formatEUR, formatDateTimeBE } from '@bricoloc/shared';
import { staffApi } from '@/lib/staff';
import { StatusBadge } from '@/components/StatusBadge';
import { SignaturePad } from '@/components/SignaturePad';
import { PhotoCapture } from '@/components/PhotoCapture';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CounterFlowHandle {
  feedScan: (code: string) => void;
}

type PickupStep = 'summary' | 'units' | 'check' | 'sign' | 'done';
type ReturnStep = 'summary' | 'check' | 'deposit' | 'done';

const PICKUP_CHECKS = [
  { key: 'complet', label: 'Matériel & accessoires complets' },
  { key: 'propre', label: 'Propre, prêt à l’emploi' },
  { key: 'fonctionnel', label: 'Testé, fonctionnel' },
  { key: 'notice', label: 'Notice / consignes remises' },
];
const RETURN_CHECKS = [
  { key: 'complet', label: 'Complet (accessoires, câbles…)' },
  { key: 'nettoye', label: 'Rendu nettoyé' },
  { key: 'fonctionnel', label: 'Fonctionne normalement' },
];

export const CounterFlow = forwardRef<
  CounterFlowHandle,
  {
    scan: any;
    onDone: () => void;
    onReload: () => Promise<void> | void;
    onExit: () => void;
  }
>(function CounterFlow({ scan, onReload, onDone, onExit }, ref) {
  const r = scan.reservation;
  // Figé à l'ouverture : le statut change en cours de parcours (READY→OUT→CLOSED).
  const [isReturn] = useState(() => ['OUT', 'RETURN_PENDING'].includes(r.status));
  const machineItems: any[] = r.items.filter((i: any) => i.kind === 'MACHINE');
  const totalMachines = machineItems.reduce((a: number, i: any) => a + i.quantity, 0);

  const [step, setStep] = useState<PickupStep | ReturnStep>('summary');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // pickup
  const [assigned, setAssigned] = useState<Record<string, { assetTag: string; productId: string }>>({});
  const [manual, setManual] = useState('');
  const [pChecks, setPChecks] = useState<Record<string, boolean>>({});
  const [signature, setSignature] = useState<string | null>(null);

  const [photos, setPhotos] = useState<string[]>([]);

  // return
  const [rChecks, setRChecks] = useState<Record<string, boolean>>({});
  const [returnAt, setReturnAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [cleaningFee, setCleaningFee] = useState(0);
  const [damages, setDamages] = useState<{ unitId: string; description: string; feeHT: number }[]>([]);
  const [depositAction, setDepositAction] = useState<'RELEASE' | 'PARTIAL' | 'CAPTURE'>('RELEASE');
  const [depositCaptured, setDepositCaptured] = useState(0);
  const [resultMsg, setResultMsg] = useState('');

  const assignedCount = Object.keys(assigned).length;

  const productNeeds = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of machineItems) m.set(i.productId, (m.get(i.productId) ?? 0) + i.quantity);
    return m;
  }, [machineItems]);

  function assignUnit(code: string) {
    setErr('');
    const unit = r.items
      .flatMap((i: any) => i.product.units)
      .find(
        (u: any) =>
          u.assetTag?.toUpperCase() === code.toUpperCase() ||
          u.qrToken === code ||
          u.barcode === code,
      );
    if (!unit) {
      setErr(`L’exemplaire « ${code} » n’appartient pas à cette réservation.`);
      return;
    }
    if (assigned[unit.id]) return;
    const already = Object.values(assigned).filter((a) => a.productId === unit.productId).length;
    if (already >= (productNeeds.get(unit.productId) ?? 0)) {
      setErr('Déjà assez d’exemplaires pour cette machine.');
      return;
    }
    if (unit.state !== 'AVAILABLE') {
      setErr(`${unit.assetTag} est « ${unit.state} » — choisissez un autre exemplaire.`);
      return;
    }
    setAssigned((s) => ({ ...s, [unit.id]: { assetTag: unit.assetTag, productId: unit.productId } }));
  }

  useImperativeHandle(ref, () => ({
    feedScan: (code: string) => {
      if (!isReturn && step === 'units') assignUnit(code);
    },
  }));

  async function collect(method: string) {
    setBusy(true);
    setErr('');
    try {
      await staffApi(`/api/ops/reservations/${r.id}/collect`, { method: 'POST', body: { method } });
      await onReload();
    } catch (e: any) {
      setErr(e?.message ?? 'Encaissement impossible');
    } finally {
      setBusy(false);
    }
  }

  async function validatePickup() {
    setBusy(true);
    setErr('');
    try {
      await staffApi('/api/ops/pickup', {
        method: 'POST',
        body: {
          reservationId: r.id,
          unitIds: Object.keys(assigned),
          checklist: pChecks,
          photos,
          customerSignature: signature ?? 'data:image/png;base64,',
          note: '',
        },
      });
      setStep('done');
    } catch (e: any) {
      setErr(e?.message ?? 'Erreur à la validation');
    } finally {
      setBusy(false);
    }
  }

  async function validateReturn() {
    setBusy(true);
    setErr('');
    try {
      const res = await staffApi<any>('/api/ops/return', {
        method: 'POST',
        body: {
          reservationId: r.id,
          actualReturnAt: new Date(returnAt).toISOString(),
          checklist: rChecks,
          photos,
          damages,
          missingAccessories: [],
          cleaningFeeHT: cleaningFee,
          otherFeeHT: 0,
          otherFeeReason: '',
          depositAction,
          depositCapturedAmount: depositCaptured,
        },
      });
      setResultMsg(
        `Retour clôturé. Retard ${res.lateDays} j (${formatEUR(res.lateFeeHT)}). ` +
          `Caution : remboursé ${formatEUR(res.deposit.refunded)}, retenu ${formatEUR(res.deposit.captured)}. ` +
          `Facture ${res.finalInvoice}.`,
      );
      setStep('done');
    } catch (e: any) {
      setErr(e?.message ?? 'Erreur au retour');
    } finally {
      setBusy(false);
    }
  }

  const customer = r.user
    ? `${r.user.firstName} ${r.user.lastName}`
    : `${r.contact?.firstName ?? ''} ${r.contact?.lastName ?? ''} (invité)`.trim();

  /* ---------------------------------------------------------------- */

  return (
    <div className="cflow">
      <div className="cflow__top">
        <button className="btn btn-ghost btn-sm" onClick={onExit}>
          ← Fermer
        </button>
        <strong>{r.number}</strong>
        <StatusBadge status={r.status} />
      </div>

      {err && <div className="alert alert-err">{err}</div>}

      {/* Fil d'étapes */}
      <ol className="cflow__steps">
        {(isReturn
          ? ['Résumé', 'Contrôle', 'Caution', 'Fait']
          : ['Résumé', 'Machines', 'Contrôle', 'Signature', 'Fait']
        ).map((label, i) => {
          const order = isReturn
            ? ['summary', 'check', 'deposit', 'done']
            : ['summary', 'units', 'check', 'sign', 'done'];
          const current = order.indexOf(step);
          return (
            <li key={label} className={i < current ? 'is-done' : i === current ? 'is-current' : ''}>
              <span>{i + 1}</span>
              {label}
            </li>
          );
        })}
      </ol>

      {/* ---------- RÉSUMÉ ---------- */}
      {step === 'summary' && (
        <div className="cflow__body">
          <p className="cflow__cust">
            <strong>{customer}</strong>
            {r.user?.phone ? ` · ${r.user.phone}` : ''}
          </p>
          <p className="small muted">
            {r.fulfilmentMode === 'DELIVERY'
              ? 'Livraison'
              : `Retrait — ${r.pickupPoint?.name ?? 'Dépôt'}`}{' '}
            · {formatDateTimeBE(r.periodStart)} → {formatDateTimeBE(r.periodEnd)}
          </p>

          <ul className="cflow__lines">
            {r.items.map((i: any) => (
              <li key={i.id}>
                {i.quantity}× {i.nameSnapshot}
                <span className="badge">{i.kind}</span>
              </li>
            ))}
          </ul>

          <div className="cflow__pay">
            <div className={`cflow__paychip ${scan.paid ? 'is-ok' : 'is-warn'}`}>
              {scan.paid ? '✓ Location payée' : '● Location à encaisser'}
              {!scan.paid && r.totals?.totalTVAC ? ` — ${formatEUR(r.totals.totalTVAC)}` : ''}
            </div>
            <div className={`cflow__paychip ${scan.depositHeld ? 'is-ok' : 'is-warn'}`}>
              Caution {r.deposit ? formatEUR(r.deposit.amount) : '—'}
              {scan.depositHeld ? ' · empreinte OK' : ` · ${r.deposit?.status ?? '—'}`}
            </div>
          </div>

          {!scan.paid && !isReturn && (
            <div className="cflow__collect">
              <p className="small">Encaisser maintenant :</p>
              <div className="cflow__btns">
                <button className="btn btn-outline" disabled={busy} onClick={() => collect('CASH')}>
                  Espèces
                </button>
                <button className="btn btn-outline" disabled={busy} onClick={() => collect('BANCONTACT')}>
                  Bancontact
                </button>
                <button className="btn btn-outline" disabled={busy} onClick={() => collect('CARD')}>
                  Carte
                </button>
              </div>
            </div>
          )}

          <div className="cflow__actions">
            {isReturn ? (
              <button className="btn btn-primary btn-lg" onClick={() => setStep('check')}>
                Contrôler le retour →
              </button>
            ) : (
              <button
                className="btn btn-primary btn-lg"
                disabled={!scan.paid}
                onClick={() => setStep(totalMachines > 0 ? 'units' : 'check')}
              >
                {scan.paid ? 'Préparer le matériel →' : 'Encaisser d’abord'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ---------- MACHINES (pickup) ---------- */}
      {step === 'units' && !isReturn && (
        <div className="cflow__body">
          <p className="cflow__hint">
            Scannez chaque machine prise en rayon — <strong>{assignedCount}/{totalMachines}</strong>
          </p>
          {machineItems.map((i: any) => {
            const need = i.quantity;
            const got = Object.values(assigned).filter((a) => a.productId === i.productId);
            return (
              <div key={i.id} className="cflow__unitline">
                <div>
                  <strong>{i.nameSnapshot}</strong>
                  <span className="small muted"> · {got.length}/{need}</span>
                </div>
                <div className="cflow__tags">
                  {got.map((g) => (
                    <span key={g.assetTag} className="chip chip--ok">
                      ✓ {g.assetTag}
                    </span>
                  ))}
                  {got.length < need && <span className="chip chip--todo">à scanner…</span>}
                </div>
              </div>
            );
          })}

          <div className="cflow__manual">
            <input
              placeholder="Code illisible ? saisir le n° d’exemplaire"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manual.trim()) {
                  assignUnit(manual.trim());
                  setManual('');
                }
              }}
            />
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                if (manual.trim()) {
                  assignUnit(manual.trim());
                  setManual('');
                }
              }}
            >
              Ajouter
            </button>
          </div>

          <div className="cflow__actions">
            <button className="btn btn-ghost" onClick={() => setStep('summary')}>
              ← Retour
            </button>
            <button
              className="btn btn-primary btn-lg"
              disabled={assignedCount < totalMachines}
              onClick={() => setStep('check')}
            >
              Contrôle →
            </button>
          </div>
        </div>
      )}

      {/* ---------- CONTRÔLE ---------- */}
      {step === 'check' && (
        <div className="cflow__body">
          <p className="cflow__hint">{isReturn ? 'État du matériel rendu' : 'Vérification avant remise'}</p>
          <div className="cflow__checks">
            {(isReturn ? RETURN_CHECKS : PICKUP_CHECKS).map((c) => {
              const state = isReturn ? rChecks : pChecks;
              const setState = isReturn ? setRChecks : setPChecks;
              return (
                <button
                  key={c.key}
                  className={`cflow__check${state[c.key] ? ' is-on' : ''}`}
                  onClick={() => setState((s) => ({ ...s, [c.key]: !s[c.key] }))}
                >
                  <span className="cflow__checkbox">{state[c.key] ? '✓' : ''}</span>
                  {c.label}
                </button>
              );
            })}
          </div>

          <div>
            <p className="small" style={{ fontWeight: 700, margin: '4px 0 6px' }}>
              {isReturn ? 'Photos de l’état au retour' : 'Photos de l’état à la sortie'}
              {!isReturn && photos.length === 0 ? ' — recommandé' : ''}
            </p>
            <PhotoCapture urls={photos} onChange={setPhotos} />
          </div>

          {isReturn && (
            <>
              <div className="field">
                <label>Heure réelle de retour</label>
                <input
                  type="datetime-local"
                  value={returnAt}
                  onChange={(e) => setReturnAt(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Frais de nettoyage HTVA (si sale)</label>
                <input
                  type="number"
                  value={cleaningFee}
                  onChange={(e) => setCleaningFee(Number(e.target.value))}
                />
              </div>
              <div className="cflow__damages">
                <div className="spread">
                  <strong>Dommages constatés</strong>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      setDamages((s) => [
                        ...s,
                        { unitId: r.items.flatMap((i: any) => i.units ?? [])[0]?.unit?.id ?? '', description: '', feeHT: 0 },
                      ])
                    }
                  >
                    + Ajouter
                  </button>
                </div>
                {damages.map((d, idx) => (
                  <div key={idx} className="cflow__damage">
                    <input
                      placeholder="Description"
                      value={d.description}
                      onChange={(e) =>
                        setDamages((s) => s.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))
                      }
                    />
                    <input
                      type="number"
                      placeholder="€ HT"
                      value={d.feeHT}
                      onChange={(e) =>
                        setDamages((s) => s.map((x, i) => (i === idx ? { ...x, feeHT: Number(e.target.value) } : x)))
                      }
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="cflow__actions">
            <button className="btn btn-ghost" onClick={() => setStep(isReturn ? 'summary' : totalMachines > 0 ? 'units' : 'summary')}>
              ← Retour
            </button>
            <button className="btn btn-primary btn-lg" onClick={() => setStep(isReturn ? 'deposit' : 'sign')}>
              {isReturn ? 'Caution →' : 'Signature →'}
            </button>
          </div>
        </div>
      )}

      {/* ---------- SIGNATURE (pickup) ---------- */}
      {step === 'sign' && !isReturn && (
        <div className="cflow__body">
          <p className="cflow__hint">Le client signe la remise du matériel</p>
          <SignaturePad onChange={setSignature} />
          <div className="cflow__actions">
            <button className="btn btn-ghost" onClick={() => setStep('check')}>
              ← Retour
            </button>
            <button className="btn btn-primary btn-lg" disabled={busy} onClick={validatePickup}>
              Valider la sortie
            </button>
          </div>
          <p className="small muted">La signature n’est pas obligatoire pour valider.</p>
        </div>
      )}

      {/* ---------- CAUTION (return) ---------- */}
      {step === 'deposit' && isReturn && (
        <div className="cflow__body">
          <p className="cflow__hint">Caution {r.deposit ? formatEUR(r.deposit.amount) : '—'}</p>
          <div className="cflow__checks">
            {(
              [
                ['RELEASE', 'Tout libérer'],
                ['PARTIAL', 'Retenir une partie'],
                ['CAPTURE', 'Tout retenir'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                className={`cflow__check${depositAction === v ? ' is-on' : ''}`}
                onClick={() => setDepositAction(v)}
              >
                <span className="cflow__checkbox">{depositAction === v ? '✓' : ''}</span>
                {label}
              </button>
            ))}
          </div>
          {depositAction === 'PARTIAL' && (
            <div className="field">
              <label>Montant retenu (€)</label>
              <input
                type="number"
                value={depositCaptured}
                onChange={(e) => setDepositCaptured(Number(e.target.value))}
              />
            </div>
          )}
          <div className="cflow__actions">
            <button className="btn btn-ghost" onClick={() => setStep('check')}>
              ← Retour
            </button>
            <button className="btn btn-primary btn-lg" disabled={busy} onClick={validateReturn}>
              Clôturer & facturer
            </button>
          </div>
        </div>
      )}

      {/* ---------- FAIT ---------- */}
      {step === 'done' && (
        <div className="cflow__body cflow__done">
          <div className="cflow__tick">✓</div>
          <h3>{isReturn ? 'Retour clôturé' : 'Matériel remis — location active'}</h3>
          {resultMsg && <p className="small muted">{resultMsg}</p>}
          <button className="btn btn-primary btn-lg" onClick={onDone}>
            Suivant
          </button>
        </div>
      )}
    </div>
  );
});
