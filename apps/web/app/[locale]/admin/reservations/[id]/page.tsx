'use client';
import { use, useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { formatEUR, formatDateTimeBE } from '@bricoloc/shared';
import { API_URL } from '@/lib/api';
import { staffApi, useStaff } from '@/lib/staff';
import { StatusBadge } from '@/components/StatusBadge';

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

  async function load() {
    const res = await staffApi<{ reservation: any }>(`/api/admin/reservations/${id}`);
    setR(res.reservation);
  }
  useEffect(() => {
    load();
  }, [id]);

  if (!r) return <p>Chargement…</p>;

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
            <h3>Lignes</h3>
            <table className="table">
              <tbody>
                {r.items.map((i: any) => (
                  <tr key={i.id}>
                    <td>
                      {i.quantity}× {i.nameSnapshot}
                      <span className="small muted"> · {i.billedDays} j · {i.appliedRule}</span>
                      {i.units?.length > 0 && (
                        <div className="small muted">
                          Exemplaires : {i.units.map((u: any) => u.unit.assetTag).join(', ')}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatEUR(i.lineHT)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="small muted">
              Période : {formatDateTimeBE(r.periodStart)} → {formatDateTimeBE(r.periodEnd)}
            </div>
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
