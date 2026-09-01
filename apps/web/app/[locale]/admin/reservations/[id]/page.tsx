'use client';
import { use, useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { formatEUR, formatDateTimeBE } from '@bricoloc/shared';
import { API_URL } from '@/lib/api';
import { staffApi, useStaff } from '@/lib/staff';
import { StatusBadge } from '@/components/StatusBadge';
import { toLocalInput, fromLocalInput } from '@/lib/dates';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AdminReservationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { token } = useStaff();
  const [r, setR] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [addSlug, setAddSlug] = useState('');
  const [fee, setFee] = useState('');
  const [disc, setDisc] = useState('');

  async function load() {
    const res = await staffApi<{ reservation: any }>(`/api/admin/reservations/${id}`);
    setR(res.reservation);
  }
  useEffect(() => {
    load();
  }, [id]);

  async function act(fn: () => Promise<unknown>, ok = 'Enregistré.') {
    try {
      await fn();
      setMsg(ok);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    }
  }

  if (!r) return <p className="loading-dark"><span className="spinner" /> Chargement…</p>;
  const editable = ['DRAFT', 'PENDING_SUPPLIER', 'CONFIRMED', 'PREPARING', 'READY'].includes(r.status);
  const t = r.totals ?? {};

  return (
    <div className="stack">
      <p className="small">
        <Link href="/admin/reservations">← Réservations</Link>
      </p>
      <div className="spread">
        <h1>
          {r.number} <StatusBadge status={r.status} />
        </h1>
        <div className="row">
          <select
            defaultValue={r.status}
            onChange={async (e) => {
              await staffApi(`/api/admin/reservations/${id}`, {
                method: 'PATCH',
                body: { status: e.target.value },
              });
              await load();
            }}
          >
            {['DRAFT', 'CONFIRMED', 'PREPARING', 'READY', 'OUT', 'RETURN_PENDING', 'RETURNED', 'CLOSED', 'CANCELLED'].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
          <button
            className="btn btn-outline btn-sm"
            onClick={async () => {
              const inv = await staffApi<{ invoice: { number: string } }>(
                `/api/admin/reservations/${id}/invoice`,
                { method: 'POST', body: { kind: 'FINAL' } },
              );
              setMsg(`Facture ${inv.invoice.number} générée.`);
              await load();
            }}
          >
            Générer facture finale
          </button>
        </div>
      </div>
      {msg && <div className="alert alert-ok">{msg}</div>}

      <div className="two-col">
        <div className="stack">
          <div className="card card-body">
            <h3>Lignes {editable && <span className="badge badge-ok">modifiable</span>}</h3>
            <table className="table">
              <tbody>
                {r.items.map((i: any) => (
                  <tr key={i.id}>
                    <td>
                      {editable ? (
                        <input
                          type="number"
                          min={1}
                          defaultValue={i.quantity}
                          style={{ width: 56 }}
                          onBlur={(e) =>
                            Number(e.target.value) !== i.quantity &&
                            act(() =>
                              staffApi(`/api/admin/reservation-items/${i.id}`, {
                                method: 'PATCH',
                                body: { quantity: Number(e.target.value) },
                              }),
                            )
                          }
                        />
                      ) : (
                        `${i.quantity}×`
                      )}{' '}
                      {i.nameSnapshot}
                      <span className="small muted"> · {i.billedDays} j · {i.appliedRule}</span>
                      {i.units?.length > 0 && (
                        <div className="small muted">
                          Exemplaires : {i.units.map((u: any) => u.unit.assetTag).join(', ')}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatEUR(i.lineHT)}</td>
                    {editable && (
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            act(
                              () =>
                                staffApi(`/api/admin/reservation-items/${i.id}`, { method: 'DELETE' }),
                              'Ligne supprimée.',
                            )
                          }
                        >
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {editable && (
              <div className="row" style={{ marginTop: 8 }}>
                <input
                  placeholder="slug produit à ajouter (ex : disqueuse-125-mm)"
                  value={addSlug}
                  onChange={(e) => setAddSlug(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    addSlug &&
                    act(async () => {
                      await staffApi(`/api/admin/reservations/${id}/items`, {
                        method: 'POST',
                        body: { productSlug: addSlug.trim(), quantity: 1 },
                      });
                      setAddSlug('');
                    }, 'Ligne ajoutée.')
                  }
                >
                  + Ajouter
                </button>
              </div>
            )}

            <div className="field-2" style={{ marginTop: 12 }}>
              <label className="field small">
                Période — début
                <input
                  type="datetime-local"
                  defaultValue={toLocalInput(r.periodStart)}
                  disabled={!editable}
                  onBlur={(e) =>
                    act(() =>
                      staffApi(`/api/admin/reservations/${id}`, {
                        method: 'PATCH',
                        body: { periodStart: fromLocalInput(e.target.value) },
                      }),
                    )
                  }
                />
              </label>
              <label className="field small">
                Période — retour
                <input
                  type="datetime-local"
                  defaultValue={toLocalInput(r.periodEnd)}
                  disabled={!editable}
                  onBlur={(e) =>
                    act(() =>
                      staffApi(`/api/admin/reservations/${id}`, {
                        method: 'PATCH',
                        body: { periodEnd: fromLocalInput(e.target.value) },
                      }),
                    )
                  }
                />
              </label>
            </div>

            {editable && (
              <div className="row" style={{ marginTop: 10 }}>
                <input placeholder="Frais € HT" value={fee} onChange={(e) => setFee(e.target.value)} style={{ width: 120 }} />
                <input placeholder="Remise € HT" value={disc} onChange={(e) => setDisc(e.target.value)} style={{ width: 120 }} />
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    act(
                      () =>
                        staffApi(`/api/admin/reservations/${id}/recompute`, {
                          method: 'POST',
                          body: {
                            extraFeesHT: fee === '' ? undefined : Number(fee),
                            extraDiscountHT: disc === '' ? undefined : Number(disc),
                          },
                        }),
                      'Recalculé.',
                    )
                  }
                >
                  Appliquer & recalculer
                </button>
              </div>
            )}
          </div>

          <div className="card card-body">
            <h3>Totaux</h3>
            <div className="line small"><span>Location HTVA</span><span>{formatEUR(t.rentalHT ?? 0)}</span></div>
            {t.deliveryFeeHT ? <div className="line small"><span>Livraison HTVA</span><span>{formatEUR(t.deliveryFeeHT)}</span></div> : null}
            {t.extraFeesHT ? <div className="line small"><span>Frais</span><span>{formatEUR(t.extraFeesHT)}</span></div> : null}
            {t.discountHT ? <div className="line small"><span>Remise</span><span>−{formatEUR(t.discountHT)}</span></div> : null}
            <div className="line"><strong>Total TVAC</strong><strong>{formatEUR(t.totalTVAC ?? 0)}</strong></div>
            <div className="line small deposit"><span>Caution</span><span>{formatEUR(t.depositsTotal ?? 0)}</span></div>
          </div>

          {r.pickup && (
            <div className="card card-body">
              <h3>Retrait</h3>
              <p className="small">
                Signé : {r.pickup.signature ? 'oui' : 'non'} ·{' '}
                {formatDateTimeBE(r.pickup.createdAt)}
              </p>
              <pre className="small">{JSON.stringify(r.pickup.checklist, null, 1)}</pre>
            </div>
          )}
          {r.return && (
            <div className="card card-body">
              <h3>Retour</h3>
              <p className="small">
                Retour réel : {formatDateTimeBE(r.return.actualReturnAt)} · Retard{' '}
                {r.return.lateDays} j ({formatEUR(r.return.lateFeeHT)}) · Nettoyage{' '}
                {formatEUR(r.return.cleaningFeeHT)}
              </p>
            </div>
          )}
          {r.damages?.length > 0 && (
            <div className="card card-body">
              <h3>Dommages</h3>
              {r.damages.map((d: any) => (
                <p key={d.id} className="small">
                  {d.description} — {formatEUR(d.feeHT)} {d.resolved ? '✔' : ''}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card card-body">
            <h3>Paiements</h3>
            {r.payments.map((p: any) => (
              <div key={p.id} className="line small">
                <span>
                  {p.kind} — {p.status}
                </span>
                <span>{formatEUR(p.amount)}</span>
              </div>
            ))}
            {r.deposit && (
              <div className="line small">
                <span>Caution ({r.deposit.status})</span>
                <span>{formatEUR(r.deposit.amount)}</span>
              </div>
            )}
          </div>
          {r.invoices?.length > 0 && (
            <div className="card card-body">
              <h3>Factures</h3>
              {r.invoices.map((inv: any) => (
                <p key={inv.id} className="small">
                  <a
                    href={`${API_URL}/api/admin/invoices/${inv.id}/pdf?token=${token()}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {inv.number} ({inv.kind}) — PDF
                  </a>
                </p>
              ))}
            </div>
          )}
          {r.deliveries?.length > 0 && (
            <div className="card card-body">
              <h3>Livraisons</h3>
              {r.deliveries.map((d: any) => (
                <p key={d.id} className="small">
                  {d.direction} — {d.status} — {formatEUR(d.feeHT)}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
