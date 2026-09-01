'use client';
import { Link } from '@/i18n/navigation';
import { useEffect, useState } from 'react';
import { formatEUR, formatDateBE } from '@bricoloc/shared';
import { staffApi } from '@/lib/staff';
import { StatusBadge } from '@/components/StatusBadge';
import { Sparkline } from '@/components/admin/Sparkline';

interface Dashboard {
  kpi: {
    products: number;
    unitsTotal: number;
    unitsOut: number;
    unitsMaint: number;
    occupancy: number;
    customers: number;
    revenuePaid: number;
    revenue30: number;
    newRes14: number;
  };
  alerts: {
    damages: number;
    openTickets: number;
    pendingSupplier: number;
    overdue: number;
    maintDue: number;
    pendingReviews: number;
    toPrepareSoon: number;
  };
  series: { date: string; revenue: number; count: number }[];
  reservationsByStatus: { status: string; _count: number }[];
  queue: {
    pickupsToday: QueueRow[];
    returnsToday: QueueRow[];
    overdue: QueueRow[];
  };
}
interface QueueRow {
  id: string;
  number: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  fulfilmentMode: string;
  customer: string;
  items: string[];
}

function QueueList({ title, rows, empty }: { title: string; rows: QueueRow[]; empty: string }) {
  return (
    <div className="card card-body">
      <h3>
        {title} <span className="badge">{rows.length}</span>
      </h3>
      {rows.length === 0 ? (
        <p className="small muted">{empty}</p>
      ) : (
        <ul className="dash-queue">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/reservations/${r.id}`}>
                <strong>{r.number}</strong> · {r.customer}
                <span className="badge" style={{ marginLeft: 6 }}>
                  {r.fulfilmentMode === 'DELIVERY' ? 'Livraison' : 'Retrait'}
                </span>
                <div className="small muted">{r.items.slice(0, 3).join(' · ')}</div>
              </Link>
              <StatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [d, setD] = useState<Dashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    staffApi<Dashboard>('/api/admin/dashboard')
      .then(setD)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erreur'));
  }, []);
  if (err) return <div className="alert alert-err">{err}</div>;
  if (!d) return <p className="loading-dark"><span className="spinner" /> Chargement…</p>;

  const alertItems = [
    ['Retours en retard', d.alerts.overdue, '/admin/comptoir', 'err'],
    ['Demandes Loiselet', d.alerts.pendingSupplier, '/admin/reservations?status=PENDING_SUPPLIER', 'warn'],
    ['Dommages à traiter', d.alerts.damages, '/admin/exemplaires', 'warn'],
    ['Maintenances à faire', d.alerts.maintDue, '/admin/exemplaires', 'warn'],
    ['Avis à modérer', d.alerts.pendingReviews, '/admin/contenus', 'info'],
    ['Tickets ouverts', d.alerts.openTickets, '/admin/reservations', 'info'],
  ].filter(([, n]) => (n as number) > 0);

  return (
    <div className="stack">
      <h1>Tableau de bord</h1>

      {/* KPI */}
      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi__label">CA 30 jours</span>
          <span className="kpi__value">{formatEUR(d.kpi.revenue30)}</span>
          <Sparkline data={d.series.map((s) => s.revenue)} />
        </div>
        <div className="kpi">
          <span className="kpi__label">Réservations (14 j)</span>
          <span className="kpi__value">{d.kpi.newRes14}</span>
          <Sparkline data={d.series.map((s) => s.count)} accent="var(--navy)" />
        </div>
        <div className="kpi">
          <span className="kpi__label">Taux d’occupation du parc</span>
          <span className="kpi__value">{d.kpi.occupancy}%</span>
          <div className="kpi__bar">
            <span style={{ width: `${d.kpi.occupancy}%` }} />
          </div>
          <span className="small muted">
            {d.kpi.unitsOut}/{d.kpi.unitsTotal} sortis · {d.kpi.unitsMaint} en maintenance
          </span>
        </div>
        <Link href="/admin/produits" className="kpi kpi--link">
          <span className="kpi__label">Produits publiés</span>
          <span className="kpi__value">{d.kpi.products}</span>
        </Link>
        <Link href="/admin/clients" className="kpi kpi--link">
          <span className="kpi__label">Clients</span>
          <span className="kpi__value">{d.kpi.customers}</span>
        </Link>
        <div className="kpi">
          <span className="kpi__label">Encaissé (total)</span>
          <span className="kpi__value">{formatEUR(d.kpi.revenuePaid)}</span>
        </div>
      </div>

      {/* Alertes */}
      {alertItems.length > 0 && (
        <div className="card card-body">
          <h3>Alertes</h3>
          <div className="dash-alerts">
            {alertItems.map(([label, n, href, tone]) => (
              <Link key={label as string} href={href as string} className={`dash-alert dash-alert--${tone}`}>
                <span className="dash-alert__n">{n as number}</span>
                <span>{label as string}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* File du jour */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
        <QueueList title="À retirer aujourd’hui" rows={d.queue.pickupsToday} empty="Aucun retrait prévu." />
        <QueueList title="Retours attendus aujourd’hui" rows={d.queue.returnsToday} empty="Aucun retour prévu." />
        {d.queue.overdue.length > 0 && (
          <QueueList title="En retard" rows={d.queue.overdue} empty="" />
        )}
      </div>

      {/* Statuts */}
      <div className="card card-body">
        <h3>Réservations par statut</h3>
        <div className="pill-row">
          {d.reservationsByStatus.map((s) => (
            <Link key={s.status} href={`/admin/reservations?status=${s.status}`} className="badge">
              {s.status} : {s._count}
            </Link>
          ))}
        </div>
      </div>

      <p className="small muted">
        Généré le {formatDateBE(new Date().toISOString())} · Données de démonstration
      </p>
    </div>
  );
}
