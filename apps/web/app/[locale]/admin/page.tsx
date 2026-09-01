'use client';
import { Link } from '@/i18n/navigation';
import { useEffect, useState } from 'react';
import { formatEUR, formatDateBE } from '@bricoloc/shared';
import { staffApi } from '@/lib/staff';
import { StatusBadge } from '@/components/StatusBadge';

interface Dashboard {
  counters: { products: number; units: number; customers: number; openTickets: number; damages: number };
  reservationsByStatus: { status: string; _count: number }[];
  revenuePaid: number;
  upcoming: {
    id: string;
    number: string;
    status: string;
    periodStart: string;
    periodEnd: string;
    fulfilmentMode: string;
    user: { firstName: string; lastName: string } | null;
    items: { quantity: number; nameSnapshot: string }[];
  }[];
}

export default function AdminDashboard() {
  const [d, setD] = useState<Dashboard | null>(null);
  useEffect(() => {
    staffApi<Dashboard>('/api/admin/dashboard').then(setD).catch(() => {});
  }, []);
  if (!d) return <p>Chargement…</p>;

  return (
    <div className="stack">
      <h1>Tableau de bord</h1>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        {[
          ['Produits', d.counters.products, '/admin/produits'],
          ['Exemplaires', d.counters.units, '/admin/exemplaires'],
          ['Clients', d.counters.customers, '/admin/clients'],
          ['Tickets ouverts', d.counters.openTickets, '/admin/reservations'],
          ['Dommages à traiter', d.counters.damages, '/admin/exemplaires'],
          ['Encaissé (démo)', formatEUR(d.revenuePaid), '/admin/reservations'],
        ].map(([label, val, href]) => (
          <Link key={label as string} href={href as string} className="card card-body">
            <div className="small muted">{label}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--loc)' }}>{val}</div>
          </Link>
        ))}
      </div>

      <div className="card card-body">
        <h3>Réservations par statut</h3>
        <div className="pill-row">
          {d.reservationsByStatus.map((s) => (
            <span key={s.status} className="badge">
              {s.status} : {s._count}
            </span>
          ))}
        </div>
      </div>

      <div className="card card-body">
        <h3>À venir / en cours</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Client</th>
                <th>Période</th>
                <th>Mode</th>
                <th>Matériel</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {d.upcoming.map((r) => (
                <tr key={r.id}>
                  <td>{r.number}</td>
                  <td>{r.user ? `${r.user.firstName} ${r.user.lastName}` : 'Invité'}</td>
                  <td className="small">
                    {formatDateBE(r.periodStart)} → {formatDateBE(r.periodEnd)}
                  </td>
                  <td>{r.fulfilmentMode === 'DELIVERY' ? 'Livraison' : 'Retrait'}</td>
                  <td className="small">
                    {r.items.map((i) => `${i.quantity}× ${i.nameSnapshot}`).join(', ')}
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>
                    <Link href={`/admin/reservations/${r.id}`} className="btn btn-ghost btn-sm">
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
