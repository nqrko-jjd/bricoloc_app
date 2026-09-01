'use client';
import { Link } from '@/i18n/navigation';
import { usePathname } from 'next/navigation';
import { StaffProvider, useStaff } from '@/lib/staff';
import { Logo } from '@/components/Logo';

const NAV = [
  ['/admin', 'Tableau de bord'],
  ['/admin/comptoir', 'Comptoir (retrait/retour)'],
  ['/admin/reservations', 'Réservations'],
  ['/admin/livraisons', 'Livraisons'],
  ['/admin/produits', 'Catalogue & produits'],
  ['/admin/exemplaires', 'Exemplaires & maintenance'],
  ['/admin/clients', 'Clients'],
  ['/admin/promotions', 'Promotions'],
  ['/admin/zones', 'Zones de livraison'],
  ['/admin/contenus', 'Contenus du site'],
  ['/admin/parametres', 'Paramètres'],
  ['/admin/equipe', 'Équipe'],
];

function Shell({ children }: { children: React.ReactNode }) {
  const { staff, loading, logout } = useStaff();
  const pathname = usePathname();

  if (loading) return <div className="section container">Chargement…</div>;
  if (!staff) return <StaffLogin />;

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div style={{ padding: '4px 12px 14px' }}>
          <Logo href="/admin" onDark />
          <div className="small" style={{ color: '#8fa3c4', marginTop: 4 }}>
            {staff.name} · {staff.role}
          </div>
        </div>
        {NAV.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={pathname === href ? 'active' : ''}
          >
            {label}
          </Link>
        ))}
        <button
          className="btn btn-ghost btn-sm"
          style={{ margin: '14px 12px' }}
          onClick={logout}
        >
          Déconnexion
        </button>
        <Link href="/" className="small" style={{ padding: '0 12px' }}>
          ← Retour au site
        </Link>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}

function StaffLogin() {
  const { login } = useStaff();
  return (
    <div className="section container" style={{ maxWidth: 420 }}>
      <Logo />
      <h1 style={{ marginTop: 16 }}>Espace équipe BRICOLOC</h1>
      <form
        className="card card-pad stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          try {
            await login(String(fd.get('email')), String(fd.get('password')));
          } catch (err) {
            alert(err instanceof Error ? err.message : 'Connexion impossible');
          }
        }}
      >
        <div className="field">
          <label>E-mail</label>
          <input name="email" type="email" required defaultValue="admin@bricoloc.example" />
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <input name="password" type="password" required defaultValue="bricoloc" />
        </div>
        <button className="btn btn-primary btn-block">Se connecter</button>
        <p className="small muted">
          Comptes démo (mdp <code>bricoloc</code>) : admin, responsable, comptoir, preparateur,
          livreur, technicien, compta @bricoloc.example
        </p>
      </form>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffProvider>
      <Shell>{children}</Shell>
    </StaffProvider>
  );
}
