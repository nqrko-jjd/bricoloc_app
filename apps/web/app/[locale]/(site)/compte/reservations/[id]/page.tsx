'use client';
import { use, useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { formatEUR, formatDateTimeBE } from '@bricoloc/shared';
import { API_URL, clientApi } from '@/lib/api';
import { useSession } from '@/lib/providers';
import type { Reservation } from '@/lib/types';
import { orderPackItems } from '@/lib/pack';
import { StatusBadge } from '@/components/StatusBadge';
import { toLocalInput } from '@/lib/dates';
import { TICKET_STATUS_LABEL } from '@bricoloc/shared';

const EXTENDABLE = ['CONFIRMED', 'READY', 'OUT', 'RETURN_PENDING'];

/** Le client choisit un JOUR ; l'heure de retour reste celle de la location. */
function endFromDay(currentEndIso: string, day: string): Date {
  const end = new Date(currentEndIso);
  const [y, m, d] = day.split('-').map(Number);
  end.setFullYear(y!, (m ?? 1) - 1, d!);
  return end;
}

export default function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, loading } = useSession();
  const [data, setData] = useState<{ reservation: Reservation; qrDataUrl: string } | null>(null);
  const [newEnd, setNewEnd] = useState('');
  const [preview, setPreview] = useState<{ extra: number } | { error: string } | null>(null);
  const [extBusy, setExtBusy] = useState(false);
  const [extMsg, setExtMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const extMsgRef = useRef<HTMLDivElement>(null);
  const lock = useRef(false); // verrou synchrone : un double-clic ne peut pas partir deux fois
  const [problem, setProblem] = useState({ subject: '', message: '' });
  const [probBusy, setProbBusy] = useState(false);
  const [probMsg, setProbMsg] = useState<{ ok: boolean; text: string; ticketId?: string } | null>(null);

  async function refresh() {
    const r = await clientApi<{ reservation: Reservation; qrDataUrl: string }>(
      `/api/reservations/${id}`,
    );
    setData(r);
    const pending = r.reservation.extensions?.find((e) => e.status === 'PENDING');
    setNewEnd((pending ? toLocalInput(pending.requestedEnd) : toLocalInput(r.reservation.periodEnd)).slice(0, 10));
  }
  useEffect(() => {
    if (user) refresh();
  }, [user, id]);

  // Chiffre le supplément dès que le jour change (rien n'est enregistré à ce stade).
  useEffect(() => {
    const res = data?.reservation;
    if (!res || !newEnd) {
      setPreview(null);
      return;
    }
    const end = endFromDay(res.periodEnd, newEnd);
    if (Number.isNaN(end.getTime()) || end.getTime() <= new Date(res.periodEnd).getTime()) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const q = await clientApi<{ estimatedExtraTVAC: number }>(`/api/reservations/${res.id}/extend`, {
          method: 'POST',
          body: { newEnd: end.toISOString(), preview: true },
        });
        if (!cancelled) setPreview({ extra: q.estimatedExtraTVAC });
      } catch (e) {
        if (!cancelled) setPreview({ error: e instanceof Error ? e.message : 'Prolongation impossible' });
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [data, newEnd]);

  async function requestExtension() {
    if (lock.current || !data) return;
    lock.current = true;
    const res = data.reservation;
    setExtBusy(true);
    setExtMsg(null);
    try {
      await clientApi(`/api/reservations/${res.id}/extend`, {
        method: 'POST',
        body: { newEnd: endFromDay(res.periodEnd, newEnd).toISOString() },
      });
      await refresh();
      setExtMsg({ ok: true, text: 'Demande envoyée ✓ L’équipe vous répond ici et par notification. Votre date de retour actuelle reste valable en attendant.' });
    } catch (e) {
      setExtMsg({ ok: false, text: e instanceof Error ? e.message : 'Prolongation impossible' });
    } finally {
      lock.current = false;
      setExtBusy(false);
      // Le message doit être visible là où le client regarde (pas en haut de page).
      requestAnimationFrame(() => extMsgRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    }
  }

  async function cancelExtension() {
    if (lock.current || !data) return;
    lock.current = true;
    setExtBusy(true);
    setExtMsg(null);
    try {
      await clientApi(`/api/reservations/${data.reservation.id}/extend/cancel`, { method: 'POST' });
      await refresh();
      setExtMsg({ ok: true, text: 'Demande annulée. Votre date de retour est inchangée.' });
    } catch (e) {
      setExtMsg({ ok: false, text: e instanceof Error ? e.message : 'Annulation impossible' });
    } finally {
      lock.current = false;
      setExtBusy(false);
    }
  }

  async function sendProblem() {
    if (lock.current || !data) return;
    lock.current = true;
    setProbBusy(true);
    setProbMsg(null);
    try {
      const out = await clientApi<{ ticketId: string }>(`/api/reservations/${data.reservation.id}/problem`, {
        method: 'POST',
        body: problem,
      });
      setProblem({ subject: '', message: '' });
      await refresh();
      setProbMsg({ ok: true, text: 'Signalement envoyé ✓ Vous pouvez suivre la réponse de l’équipe ici.', ticketId: out.ticketId });
    } catch (e) {
      setProbMsg({ ok: false, text: e instanceof Error ? e.message : 'Envoi impossible' });
    } finally {
      lock.current = false;
      setProbBusy(false);
    }
  }

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

          {EXTENDABLE.includes(r.status) &&
            (() => {
              const pending = r.extensions?.find((e) => e.status === 'PENDING');
              const currentDay = toLocalInput(r.periodEnd).slice(0, 10);
              const valid = !!newEnd && newEnd > currentDay;
              return (
                <div className="card card-body stack">
                  <h3>Prolonger la location</h3>
                  <p className="small" style={{ margin: 0 }}>
                    Retour actuel : <strong>{formatDateTimeBE(r.periodEnd)}</strong>
                  </p>

                  {pending && (
                    <div className="ticket-notice">
                      <strong>Demande en attente de validation</strong>
                      <div className="small">
                        Retour souhaité : {formatDateTimeBE(pending.requestedEnd)} · supplément estimé{' '}
                        {formatEUR(pending.extraTVAC)} TVAC. Tant que l’équipe n’a pas répondu, votre retour reste
                        fixé au {formatDateTimeBE(r.periodEnd)}.
                      </div>
                      <div className="row" style={{ marginTop: 8, gap: 8 }}>
                        {pending.ticketId && (
                          <Link href={`/compte/tickets/${pending.ticketId}`} className="btn btn-outline btn-sm">
                            Voir la conversation
                          </Link>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={cancelExtension} disabled={extBusy}>
                          Annuler la demande
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="field">
                    <label htmlFor="extend-day">{pending ? 'Modifier la date de retour souhaitée' : 'Nouvelle date de retour'}</label>
                    <input
                      id="extend-day"
                      type="date"
                      min={currentDay}
                      value={newEnd}
                      onChange={(e) => {
                        setNewEnd(e.target.value);
                        setExtMsg(null);
                      }}
                    />
                  </div>
                  {valid && preview && (
                    <p className="small" style={{ margin: 0 }}>
                      {'extra' in preview
                        ? `Supplément estimé : ${formatEUR(preview.extra)} TVAC (réglé au retour du matériel).`
                        : preview.error}
                    </p>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ alignSelf: 'flex-start' }}
                    disabled={extBusy || !valid || (!!preview && 'error' in preview)}
                    onClick={requestExtension}
                  >
                    {extBusy ? 'Envoi en cours…' : pending ? 'Mettre à jour ma demande' : 'Demander la prolongation'}
                  </button>
                  <div ref={extMsgRef} role="status" aria-live="polite">
                    {extMsg && <div className={`alert ${extMsg.ok ? 'alert-ok' : 'alert-err'}`}>{extMsg.text}</div>}
                  </div>
                </div>
              );
            })()}

          <div className="card card-body stack">
            <h3>Signaler un problème</h3>
            <p className="small muted" style={{ margin: 0 }}>
              Panne, pièce manquante, question… L’équipe vous répond dans une conversation que vous retrouvez ici.
            </p>
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
              disabled={probBusy || !problem.subject.trim() || !problem.message.trim()}
              onClick={sendProblem}
            >
              {probBusy ? 'Envoi en cours…' : 'Envoyer'}
            </button>
            <div role="status" aria-live="polite">
              {probMsg && (
                <div className={`alert ${probMsg.ok ? 'alert-ok' : 'alert-err'}`}>
                  {probMsg.text}
                  {probMsg.ticketId && (
                    <>
                      {' '}
                      <Link href={`/compte/tickets/${probMsg.ticketId}`}>Suivre ma demande →</Link>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {(r.tickets?.length ?? 0) > 0 && (
            <div className="card card-body stack">
              <h3>Mes demandes pour cette location</h3>
              {r.tickets!.map((t) => (
                <Link key={t.id} href={`/compte/tickets/${t.id}`} className="spread small">
                  <span>
                    {t.clientUnread && <span className="nav-badge" style={{ marginLeft: 0, marginRight: 8 }}>Nouveau</span>}
                    {t.subject}
                  </span>
                  <span className={`badge ${t.status === 'CLOSED' ? 'badge-ok' : ''}`}>
                    {TICKET_STATUS_LABEL[t.status]}
                  </span>
                </Link>
              ))}
            </div>
          )}
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
