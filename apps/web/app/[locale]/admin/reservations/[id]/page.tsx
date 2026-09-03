'use client';
import { use, useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { formatEUR, formatDateTimeBE } from '@bricoloc/shared';
import { API_URL } from '@/lib/api';
import { staffApi, useStaff } from '@/lib/staff';
import { orderPackItems } from '@/lib/pack';
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
  const [loiselet, setLoiselet] = useState<any>(null);
  const [loiseletTo, setLoiseletTo] = useState<string[]>([]);

  async function load() {
    const res = await staffApi<{ reservation: any }>(`/api/admin/reservations/${id}`);
    setR(res.reservation);
    const hasLoiselet = res.reservation.items?.some((i: any) => i.product?.supplier === 'LOISELET');
    if (hasLoiselet) {
      try {
        const rq = await staffApi<{ request: any }>(
          `/api/admin/reservations/${id}/loiselet-request`,
        );
        setLoiselet(rq.request);
        setLoiseletTo(rq.request.recipients ?? []);
      } catch {
        /* pas de config ou pas de ligne Loiselet */
      }
    }
  }
  useEffect(() => {
    load();
  }, [id]);

  function loiseletMailto() {
    if (!loiselet) return '#';
    const cc = (loiselet.cc ?? []).length ? `&cc=${encodeURIComponent(loiselet.cc.join(','))}` : '';
    return (
      `mailto:${encodeURIComponent(loiseletTo.join(','))}` +
      `?subject=${encodeURIComponent(loiselet.subject)}${cc}` +
      `&body=${encodeURIComponent(loiselet.body)}`
    );
  }

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
                {orderPackItems(r.items).map((i: any) => (
                  <tr key={i.id}>
                    <td style={i.packRef ? { paddingLeft: 22 } : undefined}>
                      {i.packRef ? (
                        <span className="small muted">↳ {i.quantity}× </span>
                      ) : editable ? (
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
                      <span className="small muted">
                        {i.packRef
                          ? ' · inclus dans le pack'
                          : ` · ${i.billedDays} j · ${i.appliedRule}`}
                      </span>
                      {i.units?.length > 0 && (
                        <div className="small muted">
                          Exemplaires : {i.units.map((u: any) => u.unit.assetTag).join(', ')}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {i.packRef ? <span className="small muted">—</span> : formatEUR(i.lineHT)}
                    </td>
                    {editable && (
                      <td>
                        {!i.packRef && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              act(
                                () =>
                                  staffApi(`/api/admin/reservation-items/${i.id}`, {
                                    method: 'DELETE',
                                  }),
                                'Ligne supprimée.',
                              )
                            }
                          >
                            ×
                          </button>
                        )}
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
            <div className="card card-body stack">
              <h3>Retrait — contrôle &amp; preuves</h3>
              <p className="small muted">
                {formatDateTimeBE(r.pickup.createdAt)}
                {r.pickup.note ? ` · ${r.pickup.note}` : ''}
              </p>
              <Checklist data={r.pickup.checklist} />
              <PhotoStrip label="Photos à la sortie" urls={r.pickup.photos} />
              <Signature src={r.pickup.signature} />
            </div>
          )}
          {r.return && (
            <div className="card card-body stack">
              <h3>Retour — contrôle &amp; preuves</h3>
              <p className="small">
                Retour réel : {formatDateTimeBE(r.return.actualReturnAt)} · Retard{' '}
                {r.return.lateDays} j ({formatEUR(r.return.lateFeeHT)}) · Nettoyage{' '}
                {formatEUR(r.return.cleaningFeeHT)}
              </p>
              <Checklist data={r.return.checklist} />
              <PhotoStrip label="Photos au retour" urls={r.return.photos} />
            </div>
          )}
          {r.damages?.length > 0 && (
            <div className="card card-body stack">
              <h3>Dommages</h3>
              {r.damages.map((d: any) => (
                <div key={d.id} className="stack" style={{ gap: 4 }}>
                  <p className="small">
                    {d.description} — {formatEUR(d.feeHT)} {d.resolved ? '✔ résolu' : ''}
                    {d.unit?.assetTag ? ` · ${d.unit.assetTag}` : ''}
                  </p>
                  <PhotoStrip urls={d.photos} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="stack">
          {loiselet && (
            <div className="card card-body">
              <h3>
                Demande Loiselet{' '}
                {r.supplierStatus && (
                  <span
                    className={`badge ${
                      r.supplierStatus === 'CONFIRMED'
                        ? 'badge-ok'
                        : r.supplierStatus === 'DECLINED'
                          ? 'badge-err'
                          : ''
                    }`}
                  >
                    {r.supplierStatus}
                  </span>
                )}
              </h3>
              <p className="small muted">
                {loiselet.itemCount} ligne(s) partenaire · confirmation annoncée sous ~1 h.
              </p>
              <div className="stack" style={{ gap: 4, marginBottom: 8 }}>
                {(loiselet.recipients ?? []).map((mail: string) => (
                  <label key={mail} className="row small" style={{ gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={loiseletTo.includes(mail)}
                      onChange={(e) =>
                        setLoiseletTo((cur) =>
                          e.target.checked ? [...cur, mail] : cur.filter((m) => m !== mail),
                        )
                      }
                    />
                    {mail}
                  </label>
                ))}
              </div>
              <details className="small" style={{ marginBottom: 8 }}>
                <summary>Aperçu du message</summary>
                <pre className="small" style={{ whiteSpace: 'pre-wrap' }}>{loiselet.body}</pre>
              </details>
              <div className="row" style={{ gap: 8 }}>
                <a
                  className="btn btn-primary btn-sm"
                  href={loiseletMailto()}
                  onClick={() =>
                    act(
                      () =>
                        staffApi(`/api/admin/reservations/${id}/loiselet-request`, {
                          method: 'POST',
                        }),
                      'Demande marquée envoyée.',
                    )
                  }
                >
                  Ouvrir l&apos;e-mail
                </a>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(loiselet.body);
                    setMsg('Message copié.');
                  }}
                >
                  Copier
                </button>
              </div>
              {r.supplierStatus === 'REQUESTED' && (
                <div className="row" style={{ gap: 8, marginTop: 10 }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() =>
                      act(
                        () =>
                          staffApi(`/api/admin/reservations/${id}/supplier-status`, {
                            method: 'POST',
                            body: { outcome: 'CONFIRMED' },
                          }),
                        'Réservation confirmée.',
                      )
                    }
                  >
                    Loiselet a confirmé
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      act(
                        () =>
                          staffApi(`/api/admin/reservations/${id}/supplier-status`, {
                            method: 'POST',
                            body: { outcome: 'DECLINED' },
                          }),
                        'Réservation annulée (refus Loiselet).',
                      )
                    }
                  >
                    Refusé
                  </button>
                </div>
              )}
            </div>
          )}
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

const CHECK_LABEL: Record<string, string> = {
  complet: 'Matériel & accessoires complets',
  propre: 'Propre, prêt à l’emploi',
  fonctionnel: 'Testé, fonctionnel',
  notice: 'Notice / consignes remises',
  nettoye: 'Rendu nettoyé',
};

function Checklist({ data }: { data: any }) {
  const entries = data && typeof data === 'object' ? Object.entries(data as Record<string, boolean>) : [];
  if (!entries.length) return null;
  return (
    <ul className="reslist">
      {entries.map(([k, v]) => (
        <li key={k} className={v ? 'is-ok' : 'is-no'}>
          <span aria-hidden>{v ? '✓' : '—'}</span> {CHECK_LABEL[k] ?? k}
        </li>
      ))}
    </ul>
  );
}

function PhotoStrip({ label, urls }: { label?: string; urls: any }) {
  const list: string[] = Array.isArray(urls) ? urls.filter((u) => typeof u === 'string') : [];
  if (!list.length) return null;
  return (
    <div className="stack" style={{ gap: 6 }}>
      {label ? <span className="small muted" style={{ fontWeight: 700 }}>{label}</span> : null}
      <div className="photostrip">
        {list.map((u) => (
          <a key={u} href={u} target="_blank" rel="noreferrer" title="Ouvrir en grand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" loading="lazy" />
          </a>
        ))}
      </div>
    </div>
  );
}

function Signature({ src }: { src?: string | null }) {
  if (!src) return <p className="small muted">Pas de signature.</p>;
  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="small muted" style={{ fontWeight: 700 }}>Signature du client</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="sigbox" src={src} alt="Signature du client" />
    </div>
  );
}
