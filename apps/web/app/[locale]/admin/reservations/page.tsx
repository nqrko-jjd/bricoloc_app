'use client';
import { Link } from '@/i18n/navigation';
import { useEffect, useState } from 'react';
import { formatEUR, formatDateBE } from '@bricoloc/shared';
import { staffApi } from '@/lib/staff';
import { StatusBadge } from '@/components/StatusBadge';

interface Row {
  id: string;
  number: string;
  status: string;
  channel: string;
  periodStart: string;
  periodEnd: string;
  fulfilmentMode: string;
  totals: { totalTVAC: number };
  user: { firstName: string; lastName: string } | null;
}

const STATUSES = [
  '',
  'DRAFT',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'OUT',
  'RETURN_PENDING',
  'CLOSED',
  'CANCELLED',
];

export default function AdminReservations() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    staffApi<{ reservations: Row[] }>(
      `/api/admin/reservations${status ? `?status=${status}` : ''}`,
    ).then((r) => setRows(r.reservations));
  }, [status]);

  return (
    <div className="stack">
      <h1>Réservations</h1>
      <div className="chips">
        {STATUSES.map((s) => (
          <button
            key={s || 'all'}
            className={`chip${status === s ? ' active' : ''}`}
            onClick={() => setStatus(s)}
          >
            {s || 'Toutes'}
          </button>
        ))}
      </div>
      <div className="card card-body table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Canal</th>
              <th>Client</th>
              <th>Période</th>
              <th>Mode</th>
              <th>Total TVAC</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.number}</td>
                <td>
                  <span className="badge">{r.channel}</span>
                </td>
                <td>{r.user ? `${r.user.firstName} ${r.user.lastName}` : 'Invité'}</td>
                <td className="small">
                  {formatDateBE(r.periodStart)} → {formatDateBE(r.periodEnd)}
                </td>
                <td>{r.fulfilmentMode === 'DELIVERY' ? 'Livraison' : 'Retrait'}</td>
                <td>{formatEUR(r.totals?.totalTVAC ?? 0)}</td>
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
  );
}
