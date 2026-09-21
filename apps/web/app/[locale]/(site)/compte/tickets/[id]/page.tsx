'use client';
import { use, useCallback, useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { formatDateTimeBE, TICKET_KIND_LABEL, TICKET_STATUS_LABEL } from '@bricoloc/shared';
import { clientApi } from '@/lib/api';
import { useSession } from '@/lib/providers';
import { TicketThread, type ThreadMessage } from '@/components/TicketThread';

interface TicketDetail {
  id: string;
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  kind: string;
  createdAt: string;
  reservation: { id: string; number: string; periodEnd: string } | null;
  extension: { status: string; requestedEnd: string; extraTVAC: number } | null;
}

export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useSession();
  const [data, setData] = useState<{ ticket: TicketDetail; messages: ThreadMessage[] } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await clientApi(`/api/account/tickets/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversation introuvable');
    }
  }, [id]);

  useEffect(() => {
    if (!user) return;
    void load();
    // « Petit chat » : la réponse de l'équipe apparaît sans recharger la page.
    const timer = setInterval(() => void load(), 15_000);
    return () => clearInterval(timer);
  }, [user, load]);

  if (loading) return <div className="section container">Chargement…</div>;
  if (!user)
    return (
      <div className="section container">
        Connexion requise. <Link href="/connexion">Se connecter</Link>
      </div>
    );
  if (error) return <div className="section container"><p className="alert alert-err">{error}</p></div>;
  if (!data) return <div className="section container">Chargement…</div>;

  const t = data.ticket;
  return (
    <div className="section container stack" style={{ maxWidth: 760 }}>
      <p className="small">
        <Link href="/compte">← Mon compte</Link>
        {t.reservation && (
          <>
            {' · '}
            <Link href={`/compte/reservations/${t.reservation.id}`}>Location {t.reservation.number}</Link>
          </>
        )}
      </p>
      <div className="spread">
        <h1 style={{ margin: 0 }}>{t.subject}</h1>
        <span className={`badge ${t.status === 'CLOSED' ? 'badge-ok' : ''}`}>{TICKET_STATUS_LABEL[t.status]}</span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {TICKET_KIND_LABEL[t.kind] ?? t.kind} · ouverte le {formatDateTimeBE(t.createdAt)}
      </p>

      {t.extension?.status === 'PENDING' && (
        <div className="ticket-notice">
          Prolongation demandée jusqu’au <strong>{formatDateTimeBE(t.extension.requestedEnd)}</strong> — en attente de
          validation par l’équipe.
        </div>
      )}
      {t.extension?.status === 'APPROVED' && t.reservation && (
        <div className="ticket-notice ticket-notice--ok">
          Prolongation acceptée : votre retour est fixé au <strong>{formatDateTimeBE(t.reservation.periodEnd)}</strong>.
        </div>
      )}

      <div className="card card-body">
        <TicketThread
          viewer="CLIENT"
          messages={data.messages}
          placeholder={t.status === 'CLOSED' ? 'Écrire pour rouvrir la conversation…' : 'Votre message à l’équipe BRICOLOC…'}
          onSend={async (body) => {
            await clientApi(`/api/account/tickets/${id}/messages`, { method: 'POST', body: { body } });
            await load();
          }}
        />
      </div>
    </div>
  );
}
