'use client';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { usePathname } from 'next/navigation';
import { StaffProvider, useStaff } from '@/lib/staff';
import { Logo } from '@/components/Logo';

const NAV = [
  ['/admin', 'Tableau de bord'],
  ['/admin/comptoir', 'Comptoir (retrait/retour)'],
  ['/terminal', 'Terminal Zebra (handheld)'],
  ['/admin/reservations', 'Réservations'],
  ['/admin/planning', 'Planning'],
  ['/admin/livraisons', 'Livraisons'],
  ['/admin/produits', 'Catalogue & produits'],
  ['/admin/exemplaires', 'Stock & exemplaires'],
  ['/admin/etiquettes', 'Étiquettes QR'],
  ['/admin/clients', 'Clients'],
  ['/admin/promotions', 'Promotions'],
  ['/admin/zones', 'Livraison'],
  ['/admin/contenus', 'Contenus & avis'],
  ['/admin/conseils', 'Magazine Conseils'],
  ['/admin/import-export', 'Import / export CSV'],
  ['/admin/parametres', 'Paramètres'],
  ['/admin/equipe', 'Équipe'],
];

function Shell({ children }: { children: React.ReactNode }) {
  const { staff, loading, logout } = useStaff();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => setNavOpen(false), [pathname]);

  if (loading)
    return (
      <div className="section container">
        <span className="spinner" /> Chargement…
      </div>
    );
  if (!staff) return <StaffLogin />;

  const current = NAV.find(([href]) => href === pathname)?.[1] ?? 'Back-office';

  const sideContent = (
    <>
      <div style={{ padding: '4px 12px 14px' }}>
        <Logo href="/admin" onDark />
        <div className="small" style={{ color: '#8fa3c4', marginTop: 4 }}>
          {staff.name} · {staff.role}
        </div>
      </div>
      {NAV.map(([href, label]) => (
        <Link key={href} href={href} className={pathname === href ? 'active' : ''}>
          {label}
        </Link>
      ))}
      <button className="btn btn-ghost btn-sm" style={{ margin: '14px 12px' }} onClick={logout}>
        Déconnexion
      </button>
      <Link href="/" className="small" style={{ padding: '0 12px' }}>
        ← Retour au site
      </Link>
    </>
  );

  return (
    <div className="admin-shell">
      {/* Barre supérieure mobile */}
      <div className="admin-topbar">
        <button
          className="burger burger--light"
          aria-label="Menu"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <strong>{current}</strong>
      </div>

      <div
        className={`admin-side__backdrop${navOpen ? ' is-open' : ''}`}
        onClick={() => setNavOpen(false)}
        aria-hidden
      />
      <aside className={`admin-side${navOpen ? ' is-open' : ''}`}>{sideContent}</aside>
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
