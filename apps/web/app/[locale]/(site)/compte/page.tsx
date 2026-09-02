'use client';
import { Link } from '@/i18n/navigation';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatEUR, formatDateBE, formatDateTimeBE } from '@bricoloc/shared';
import { clientApi } from '@/lib/api';
import { useSession, useCart } from '@/lib/providers';
import type { Reservation } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';

export default function ComptePage() {
  const { user, loading, logout } = useSession();
  const { reload } = useCart();
  const router = useRouter();
  const [tab, setTab] = useState<'reservations' | 'notifications' | 'adresses' | 'profil'>(
    'reservations',
  );
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [notifs, setNotifs] = useState<{ id: string; type: string; title: string; body: string; createdAt: string; readAt: string | null }[]>([]);
  const [addresses, setAddresses] = useState<{ id: string; line1: string; postalCode: string; city: string; label: string | null }[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push('/connexion');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    clientApi<{ reservations: Reservation[] }>('/api/reservations').then((r) =>
      setReservations(r.reservations),
    );
    clientApi<{ notifications: typeof notifs }>('/api/account/notifications').then((r) =>
      setNotifs(r.notifications),
    );
    clientApi<{ addresses: typeof addresses }>('/api/account/addresses').then((r) =>
      setAddresses(r.addresses),
    );
  }, [user]);

  if (loading || !user) return <div className="section container">Chargement…</div>;

  async function reorder(id: string) {
    const r = await clientApi<{ items: { productId: string; quantity: number }[] }>(
      `/api/reservations/${id}/reorder`,
      { method: 'POST' },
    );
    for (const it of r.items) {
      await clientApi('/api/cart/items', { method: 'POST', body: it });
    }
    await reload();
    router.push('/panier');
  }

  return (
    <div className="section container">
      <div className="spread">
        <h1>Bonjour {user.firstName}</h1>
        <button className="btn btn-ghost btn-sm" onClick={logout}>
          Déconnexion
        </button>
      </div>
      <p className="muted small">
        {user.customerType === 'PRO' ? `Compte pro — ${user.companyName ?? ''}` : 'Compte particulier'}
      </p>

      <div className="chips" style={{ margin: '16px 0' }}>
        {(['reservations', 'notifications', 'adresses', 'profil'] as const).map((t) => (
          <button
            key={t}
            className={`chip${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'reservations'
              ? 'Réservations'
              : t === 'notifications'
                ? `Notifications${notifs.filter((n) => !n.readAt).length ? ` (${notifs.filter((n) => !n.readAt).length})` : ''}`
                : t === 'adresses'
                  ? 'Adresses'
                  : 'Profil'}
          </button>
        ))}
      </div>

      {tab === 'reservations' && (
        <div className="stack">
          {reservations.length === 0 && <p className="muted">Aucune réservation pour le moment.</p>}
          {reservations.map((r) => (
            <div key={r.id} className="card card-body">
              <div className="spread">
                <div>
                  <strong>{r.number}</strong> <StatusBadge status={r.status} />
                  <div className="small muted">
                    {formatDateBE(r.periodStart)} → {formatDateBE(r.periodEnd)} ·{' '}
                    {r.fulfilmentMode === 'DELIVERY' ? 'Livraison' : 'Retrait'} ·{' '}
                    {formatEUR(r.totals.totalTVAC)} TVAC
                  </div>
                </div>
                <div className="row">
                  <button className="btn btn-ghost btn-sm" onClick={() => reorder(r.id)}>
                    Recommander
                  </button>
                  <Link href={`/compte/reservations/${r.id}`} className="btn btn-outline btn-sm">
                    Détails / QR
                  </Link>
                </div>
              </div>
              <div className="small muted" style={{ marginTop: 6 }}>
                {r.items.map((i) => `${i.quantity}× ${i.nameSnapshot}`).join(' · ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'notifications' && (
        <div className="stack">
          <button
            className="btn btn-ghost btn-sm"
            style={{ alignSelf: 'flex-start' }}
            onClick={async () => {
              await clientApi('/api/account/notifications/read', { method: 'POST' });
              setNotifs((s) => s.map((n) => ({ ...n, readAt: new Date().toISOString() })));
            }}
          >
            Tout marquer comme lu
          </button>
          {notifs.length === 0 && <p className="muted">Aucune notification.</p>}
          {notifs.map((n) => (
            <div
              key={n.id}
              className="card card-body"
              style={{ borderLeft: n.readAt ? undefined : '4px solid var(--brico)' }}
            >
              <strong>{n.title}</strong>
              <p className="small" style={{ margin: '4px 0' }}>
                {n.body}
              </p>
              <span className="small muted">{formatDateTimeBE(n.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'adresses' && (
        <AddressManager addresses={addresses} setAddresses={setAddresses} />
      )}

      {tab === 'profil' && (
        <div className="card card-body stack">
          <div className="field-2">
            <div className="field">
              <label>Nom</label>
              <input readOnly value={`${user.firstName} ${user.lastName}`} />
            </div>
            <div className="field">
              <label>E-mail</label>
              <input readOnly value={user.email} />
            </div>
          </div>
          <div className="field">
            <label>Téléphone</label>
            <input readOnly value={user.phone} />
          </div>
          <p className="small muted">
            Modification du profil disponible via l&apos;API (`PATCH /api/account/profile`) et
            l&apos;application mobile.
          </p>
        </div>
      )}
    </div>
  );
}

function AddressManager({
  addresses,
  setAddresses,
}: {
  addresses: { id: string; line1: string; postalCode: string; city: string; label: string | null }[];
  setAddresses: React.Dispatch<React.SetStateAction<typeof addresses>>;
}) {
  const [f, setF] = useState({ label: '', line1: '', postalCode: '', city: '' });
  return (
    <div className="stack">
      {addresses.map((a) => (
        <div key={a.id} className="card card-body spread">
          <span>
            {a.label ? <strong>{a.label} — </strong> : null}
            {a.line1}, {a.postalCode} {a.city}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              await clientApi(`/api/account/addresses/${a.id}`, { method: 'DELETE' });
              setAddresses((s) => s.filter((x) => x.id !== a.id));
            }}
          >
            Supprimer
          </button>
        </div>
      ))}
      <div className="card card-body stack">
        <h3 style={{ fontSize: '1rem' }}>Ajouter une adresse</h3>
        <div className="field-2">
          <div className="field">
            <label>Libellé</label>
            <input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
          </div>
          <div className="field">
            <label>Rue et numéro</label>
            <AddressAutocomplete
              value={f.line1}
              onChange={(line1) => setF((s) => ({ ...s, line1 }))}
              onPick={(a) =>
                setF((s) => ({
                  ...s,
                  line1: a.line1,
                  postalCode: a.postalCode || s.postalCode,
                  city: a.city || s.city,
                }))
              }
            />
          </div>
        </div>
        <div className="field-2">
          <div className="field">
            <label>Code postal</label>
            <input
              value={f.postalCode}
              onChange={(e) => setF({ ...f, postalCode: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Ville</label>
            <input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          </div>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          style={{ alignSelf: 'flex-start' }}
          onClick={async () => {
            const r = await clientApi<{ address: (typeof addresses)[number] }>(
              '/api/account/addresses',
              { method: 'POST', body: { ...f, country: 'BE' } },
            );
            setAddresses((s) => [...s, r.address]);
            setF({ label: '', line1: '', postalCode: '', city: '' });
          }}
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}
