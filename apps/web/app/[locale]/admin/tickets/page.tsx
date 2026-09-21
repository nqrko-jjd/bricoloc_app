'use client';
import { useCallback, useEffect, useState } from 'react';
import { formatDateTimeBE, formatEUR, TICKET_KIND_LABEL, TICKET_STATUS_LABEL } from '@bricoloc/shared';
import { Link } from '@/i18n/navigation';
import { staffApi } from '@/lib/staff';
import { TicketThread, type ThreadMessage } from '@/components/TicketThread';

/* eslint-disable @typescript-eslint/no-explicit-any */
const FILTERS: [string, string][] = [
  ['ACTIVE', 'À traiter'],
  ['OPEN', 'Ouverts'],
  ['IN_PROGRESS', 'En cours'],
  ['CLOSED', 'Clôturés'],
  ['ALL', 'Tous'],
];

const statusBadge = (s: string) => (s === 'CLOSED' ? 'badge-ok' : s === 'OPEN' ? 'badge-warn' : '');

export default function AdminTickets() {
  const [filter, setFilter] = useState('ACTIVE');
  const [q, setQ] = useState('');
  const [tickets, setTickets] = useState<any[]>([]);
  const [counts, setCounts] = useState({ open: 0, inProgress: 0, closed: 0, unread: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ ticket: any; messages: ThreadMessage[] } | null>(null);
  const [note, setNote] = useState('');

  const loadList = useCallback(async () => {
    const r = await staffApi<{ tickets: any[]; counts: typeof counts }>(`/api/admin/tickets?status=${filter}`);
    setTickets(r.tickets);
    setCounts(r.counts);
  }, [filter]);

  const loadDetail = useCallback(async (id: string) => {
    setDetail(await staffApi(`/api/admin/tickets/${id}`));
  }, []);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t');
    if (t) setSelectedId(t);
  }, []);

  useEffect(() => {
    void loadList();
    const timer = setInterval(() => void loadList(), 20_000);
    return () => clearInterval(timer);
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) return;
    setNote('');
    void loadDetail(selectedId);
    const timer = setInterval(() => void loadDetail(selectedId), 15_000);
    return () => clearInterval(timer);
  }, [selectedId, loadDetail]);

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? tickets.filter((t) =>
        [t.subject, t.reservation?.number, t.user?.firstName, t.user?.lastName, t.user?.email]
          .filter(Boolean)
          .some((v: string) => v.toLowerCase().includes(needle)),
      )
    : tickets;

  async function act(fn: () => Promise<unknown>) {
    setNote('');
    try {
      await fn();
      if (selectedId) await loadDetail(selectedId);
      await loadList();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Action impossible');
    }
  }

  const t = detail?.ticket;
  const ext = t?.extension;

  return (
    <div className="stack">
      <div className="spread">
        <h1>
          Tickets &amp; messages
          {counts.unread > 0 && <span className="nav-badge">{counts.unread} nouveau(x)</span>}
        </h1>
      </div>

      <div className="ticket-split">
        <div className="card">
          <div className="card-body stack" style={{ paddingBottom: 8 }}>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  className={`btn btn-sm ${filter === key ? 'btn-secondary' : 'btn-ghost'}`}
                  onClick={() => setFilter(key)}
                >
                  {label}
                  {key === 'OPEN' && counts.open > 0 ? ` (${counts.open})` : ''}
                  {key === 'IN_PROGRESS' && counts.inProgress > 0 ? ` (${counts.inProgress})` : ''}
                </button>
              ))}
            </div>
            <input
              type="search"
              placeholder="Rechercher (client, n° de réservation, sujet)…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {shown.length === 0 && <p className="small muted card-body">Aucun ticket.</p>}
          {shown.map((row) => (
            <button
              key={row.id}
              className={`ticket-row${selectedId === row.id ? ' is-active' : ''}${row.staffUnread ? ' is-unread' : ''}`}
              onClick={() => setSelectedId(row.id)}
            >
              <div className="spread">
                <strong>{row.subject}</strong>
                <span className={`badge ${statusBadge(row.status)}`}>{TICKET_STATUS_LABEL[row.status as keyof typeof TICKET_STATUS_LABEL] ?? row.status}</span>
              </div>
              <div className="small muted">
                {TICKET_KIND_LABEL[row.kind] ?? row.kind}
                {row.user ? ` · ${row.user.firstName} ${row.user.lastName}` : ' · visiteur'}
                {row.reservation ? ` · ${row.reservation.number}` : ''}
              </div>
              <div className="small" style={{ opacity: 0.8, marginTop: 2 }}>
                {(row.messages?.[0]?.body ?? row.message).slice(0, 90)}
              </div>
              <div className="small muted">{formatDateTimeBE(row.lastMessageAt)}</div>
            </button>
          ))}
        </div>

        <div className="card card-body stack">
          {!detail || !t ? (
            <p className="muted">Sélectionnez un ticket pour lire la conversation et répondre.</p>
          ) : (
            <>
              <div className="spread">
                <h2 style={{ margin: 0 }}>{t.subject}</h2>
                <select
                  value={t.status}
                  onChange={(e) =>
                    act(() => staffApi(`/api/admin/tickets/${t.id}`, { method: 'PATCH', body: { status: e.target.value } }))
                  }
                >
                  {Object.entries(TICKET_STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="small">
                {t.user ? (
                  <>
                    <Link href={`/admin/clients/${t.user.id}`}>
                      {t.user.firstName} {t.user.lastName}
                    </Link>
                    {t.user.phone && (
                      <>
                        {' · '}
                        <a href={`tel:${t.user.phone}`}>{t.user.phone}</a>
                      </>
                    )}
                    {' · '}
                    <a href={`mailto:${t.user.email}`}>{t.user.email}</a>
                  </>
                ) : (
                  <span className="muted">Visiteur (formulaire de contact) — coordonnées dans le message.</span>
                )}
                {t.reservation && (
                  <>
                    {' · Réservation '}
                    <Link href={`/admin/reservations/${t.reservation.id}`}>{t.reservation.number}</Link>
                  </>
                )}
              </div>

              {ext && (
                <div className={`ticket-notice${ext.status === 'APPROVED' ? ' ticket-notice--ok' : ''}`}>
                  <strong>Demande de prolongation</strong>
                  <div className="small">
                    Retour actuel : {formatDateTimeBE(t.reservation?.periodEnd ?? ext.previousEnd)}
                    {ext.status === 'PENDING' && <> → souhaité : <strong>{formatDateTimeBE(ext.requestedEnd)}</strong></>}
                    {' · '}supplément estimé {formatEUR(ext.extraTVAC)} TVAC
                  </div>
                  {ext.status === 'PENDING' ? (
                    <div className="row" style={{ marginTop: 8, gap: 8 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() =>
                          act(() => staffApi(`/api/admin/extensions/${ext.id}/approve`, { method: 'POST' }))
                        }
                      >
                        Accepter — prolonger la réservation
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          const reason = window.prompt('Motif du refus (visible par le client, facultatif) :') ?? undefined;
                          if (reason === undefined) return;
                          void act(() =>
                            staffApi(`/api/admin/extensions/${ext.id}/reject`, { method: 'POST', body: { reason } }),
                          );
                        }}
                      >
                        Refuser
                      </button>
                    </div>
                  ) : (
                    <div className="small">
                      {ext.status === 'APPROVED' ? 'Acceptée' : ext.status === 'REJECTED' ? 'Refusée' : 'Annulée'}
                      {ext.decidedBy ? ` par ${ext.decidedBy}` : ''}.
                    </div>
                  )}
                </div>
              )}
              {note && <p className="small" style={{ color: 'var(--err)' }}>{note}</p>}

              <TicketThread
                viewer="STAFF"
                messages={detail.messages}
                placeholder={t.user ? 'Répondre au client (il est prévenu par notification)…' : 'Note interne (visiteur sans compte : répondre par e-mail)…'}
                onSend={async (body) => {
                  await staffApi(`/api/admin/tickets/${t.id}/messages`, { method: 'POST', body: { body } });
                  await loadDetail(t.id);
                  await loadList();
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
