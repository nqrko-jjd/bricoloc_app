'use client';
import { use, useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { formatEUR, formatDateTimeBE } from '@bricoloc/shared';
import { API_URL, clientApi } from '@/lib/api';
import { useSession } from '@/lib/providers';
import type { Reservation } from '@/lib/types';
import { orderPackItems } from '@/lib/pack';
import { StatusBadge } from '@/components/StatusBadge';
import { toLocalInput, fromLocalInput } from '@/lib/dates';

export default function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, loading } = useSession();
  const [data, setData] = useState<{ reservation: Reservation; qrDataUrl: string } | null>(null);
  const [newEnd, setNewEnd] = useState('');
  const [msg, setMsg] = useState('');
  const [problem, setProblem] = useState({ subject: '', message: '' });

  async function refresh() {
    const r = await clientApi<{ reservation: Reservation; qrDataUrl: string }>(
      `/api/reservations/${id}`,
    );
    setData(r);
    setNewEnd(toLocalInput(r.reservation.periodEnd));
  }
  useEffect(() => {
    if (user) refresh();
  }, [user, id]);

  if (loading) return <div className="section container">Chargement…</div>;
  if (!user) return <div className="section container">Connexion requise. <Link href="/connexion">Se connecter</Link></div>;
  if (!data) return <div className="section container">Chargement…</div>;

  const r = data.reservation;

  return (
    <div className="section container">
      <p className="small">
        <Link href="/compte">← Mes réservations</Link>
      </p>
      <div className="spread">
        <h1>{r.number}</h1>
        <StatusBadge status={r.status} />
      </div>

      <div className="two-col">
        <div className="stack">
          <div className="card card-body">
            <h3>Matériel</h3>
            <table className="table">
              <tbody>
                {orderPackItems(r.items).map((i) => (
                  <tr key={i.id}>
                    <td style={i.packRef ? { paddingLeft: 22, opacity: 0.75 } : undefined}>
                      {i.packRef && <span aria-hidden>↳ </span>}
                      {i.quantity}× {i.nameSnapshot}
                      {!i.packRef && i.kind !== 'CONSUMABLE' && (
                        <span className="small muted"> · {i.billedDays} j</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {i.packRef ? (
                        <span className="small muted">inclus</span>
                      ) : (
                        formatEUR(i.lineHT)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="small muted">
              Période : {formatDateTimeBE(r.periodStart)} → {formatDateTimeBE(r.periodEnd)}
            </div>
          </div>

          <div className="card card-body">
            <h3>Paiements &amp; caution</h3>
            {r.payments.map((p) => (
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

          {r.invoices.length > 0 && (
            <div className="card card-body">
              <h3>Factures</h3>
              {r.invoices.map((inv) => (
                <p key={inv.id} className="small">
                  <a
                    href={`${API_URL}/api/reservations/${r.id}/invoices/${inv.id}/pdf?token=${
                      typeof window !== 'undefined'
                        ? localStorage.getItem('bricoloc_token')
                        : ''
                    }`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {inv.number} ({inv.kind === 'FINAL' ? 'facture finale' : 'réservation'}) — PDF
                  </a>
                </p>
              ))}
            </div>
          )}

          {['CONFIRMED', 'READY', 'OUT', 'RETURN_PENDING'].includes(r.status) && (
            <div className="card card-body stack">
              <h3>Prolonger la location</h3>
              <div className="row">
                <input
                  type="datetime-local"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    setMsg('');
                    try {
                      const res = await clientApi<{ estimatedExtraTVAC: number }>(
                        `/api/reservations/${r.id}/extend`,
                        { method: 'POST', body: { newEnd: fromLocalInput(newEnd) } },
                      );
                      setMsg(
                        `Demande envoyée. Supplément estimé : ${formatEUR(res.estimatedExtraTVAC)} TVAC. L'équipe confirme sous peu.`,
                      );
                    } catch (e) {
                      setMsg(e instanceof Error ? e.message : 'Prolongation impossible');
                    }
                  }}
                >
                  Demander
                </button>
              </div>
              {msg && <p className="small">{msg}</p>}
            </div>
          )}

          <div className="card card-body stack">
            <h3>Signaler un problème</h3>
            <input
              placeholder="Sujet"
              value={problem.subject}
              onChange={(e) => setProblem({ ...problem, subject: e.target.value })}
            />
            <textarea
              placeholder="Décrivez le problème"
              value={problem.message}
              onChange={(e) => setProblem({ ...problem, message: e.target.value })}
            />
            <button
              className="btn btn-outline btn-sm"
              style={{ alignSelf: 'flex-start' }}
              onClick={async () => {
                await clientApi(`/api/reservations/${r.id}/problem`, {
                  method: 'POST',
                  body: problem,
                });
                setProblem({ subject: '', message: '' });
                setMsg('Signalement envoyé à l&apos;équipe BRICOLOC.');
              }}
            >
              Envoyer
            </button>
          </div>
        </div>

        <div className="card card-pad summary center">
          <h3>QR code</h3>
          <div className="qr-box">
            <img src={data.qrDataUrl} alt="QR code" />
          </div>
          <p className="small muted">{r.qrToken}</p>
          <p className="small">
            {r.fulfilmentMode === 'DELIVERY' ? 'Livraison' : 'Retrait au comptoir'}
            {r.slot ? ` · ${r.slot}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
