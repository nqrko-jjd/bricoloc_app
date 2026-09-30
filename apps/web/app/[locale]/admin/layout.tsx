'use client';
import { useCallback, useEffect, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { StaffProvider, staffApi, useStaff } from '@/lib/staff';
import { Logo } from '@/components/Logo';
import { useDrawerFocus } from '@/components/useDrawerFocus';
import { ArrowRight, CalendarClock, PackageIcon, Truck, Wrench, User, Search, ShieldCheck } from '@/components/icons';

const GROUPS = [
  { label: 'Vue d’ensemble', Icon: CalendarClock, links: [['/admin', 'Tableau de bord']] },
  { label: 'Opérations', Icon: Truck, links: [
    ['/admin/comptoir', 'Retraits & retours'], ['/admin/reservations', 'Réservations'],
    ['/admin/planning', 'Planning'], ['/admin/livraisons', 'Tournées de livraison'],
    ['/admin/tickets', 'Messages & assistance'], ['/terminal', 'Terminal Zebra'],
  ] },
  { label: 'Matériel', Icon: PackageIcon, links: [
    ['/admin/produits', 'Catalogue & produits'], ['/admin/bricopacks', 'BricoPacks'],
    ['/admin/inventaire', 'Inventaire du parc'], ['/admin/exemplaires', 'Stock & exemplaires'],
    ['/admin/parc-chantier', 'Parc chantier (JJD)'], ['/admin/etiquettes', 'Étiquettes QR'],
  ] },
  { label: 'Clients & communication', Icon: User, links: [
    ['/admin/clients', 'Clients'], ['/admin/promotions', 'Promotions'],
    ['/admin/contenus', 'Contenus & avis'], ['/admin/conseils', 'Conseils & DIY'],
  ] },
  { label: 'Configuration', Icon: Wrench, links: [
    ['/admin/zones', 'Zones de livraison'], ['/admin/import-export', 'Import / export'],
    ['/admin/parametres', 'Paramètres'], ['/admin/equipe', 'Équipe'],
  ] },
];
const NAV = GROUPS.flatMap((g) => g.links);
const isActive = (pathname: string, href: string) => pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`));

function Shell({ children }: { children: React.ReactNode }) {
  const { staff, loading, logout } = useStaff();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [query, setQuery] = useState('');
  const close = useCallback(() => setNavOpen(false), []);
  const drawerRef = useDrawerFocus(navOpen, close);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 901px)');
    const onResize = () => { if (desktop.matches) close(); };
    desktop.addEventListener('change', onResize);
    return () => desktop.removeEventListener('change', onResize);
  }, [close]);
  useEffect(() => setNavOpen(false), [pathname]);
  useEffect(() => {
    if (!staff) return;
    let cancelled = false;
    const load = () => staffApi<{ counts: { unread: number } }>('/api/admin/tickets?status=OPEN')
      .then((r) => { if (!cancelled) setUnread(r.counts.unread); }).catch(() => undefined);
    void load();
    const t = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [staff, pathname]);
  if (loading) return <div className="section container" role="status"><span className="spinner" /> Chargement de votre espace…</div>;
  if (!staff) return <StaffLogin />;
  const current = NAV.find(([href]) => isActive(pathname, href))?.[1] ?? 'Espace équipe';
  const sideContent = (
    <>
      <div className="admin-brand"><Logo href="/admin" onDark /><span>Espace équipe</span></div>
      <label className="admin-nav-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Trouver une rubrique…" aria-label="Rechercher une rubrique" /></label>
      <nav aria-label="Navigation de l’administration" className="admin-nav">
        {GROUPS.map(({ label, Icon, links }) => {
          const filtered = links.filter(([, text]) => !query || `${label} ${text}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')));
          if (!filtered.length) return null;
          return <section className="admin-nav-group" key={label}>
            <h2><Icon /> {label}</h2>
            {filtered.map(([href, text]) => <Link key={href} href={href} className={isActive(pathname, href) ? 'active' : ''} aria-current={isActive(pathname, href) ? 'page' : undefined}>
              {text}{href === '/admin/tickets' && unread > 0 && <span className="nav-badge">{unread}</span>}
            </Link>)}
          </section>;
        })}
        {query && !NAV.some(([, text]) => text.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))) && <p className="small">Essayez « stock », « clients » ou « planning ».</p>}
      </nav>
      <div className="admin-side-footer">
        <span className="admin-avatar" aria-hidden>{staff.name.slice(0, 1).toUpperCase()}</span>
        <div><strong>{staff.name}</strong><span>{staff.role}</span></div>
        <button onClick={logout} title="Déconnexion" aria-label="Déconnexion"><ArrowRight /></button>
      </div>
      <Link href="/" className="admin-site-link">← Voir le site</Link>
    </>
  );
  return <div className="admin-shell">
    <div className="admin-topbar">
      <button className="burger burger--light" aria-label="Ouvrir le menu" aria-expanded={navOpen} onClick={() => setNavOpen(true)}><span /><span /><span /></button>
      <strong>{current}</strong>
    </div>
    <div className={`admin-side__backdrop${navOpen ? ' is-open' : ''}`} onClick={close} aria-hidden />
    <aside className="admin-side admin-side--desktop">{sideContent}</aside>
    <div ref={drawerRef} className={`admin-side admin-side--mobile${navOpen ? ' is-open' : ''}`} role="dialog" aria-modal={navOpen || undefined} aria-label="Navigation équipe" inert={!navOpen}>
      <button className="drawer-close" onClick={close}>Fermer ×</button>{sideContent}
    </div>
    <main className="admin-main">
      <header className="admin-workspace-bar"><span>BRICOLOC <span aria-hidden>/</span> <strong>{current}</strong></span><Link href="/admin/comptoir" className="btn btn-outline btn-sm">Ouvrir le comptoir <ArrowRight /></Link></header>
      {children}
    </main>
  </div>;
}

function StaffLogin() {
  const { login } = useStaff();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  return <div className="staff-login">
    <div className="staff-login__story"><Logo onDark /><span className="kicker">ESPACE ÉQUIPE</span><h1>Une bonne journée<br />commence ici.</h1><p>Réservations, matériel, retraits et retours : votre atelier, au même endroit.</p><ShieldCheck /></div>
    <div className="staff-login__form"><h2>Bienvenue dans l’atelier.</h2><p className="muted">Connectez-vous avec votre compte équipe.</p>
      <form className="stack" onSubmit={async (e) => {
        e.preventDefault(); if (pending) return;
        const fd = new FormData(e.currentTarget); setPending(true); setError('');
        try { await login(String(fd.get('email')), String(fd.get('password'))); }
        catch (err) { setError(err instanceof Error ? err.message : 'Connexion impossible'); }
        finally { setPending(false); }
      }}>
        <div className="field"><label htmlFor="staff-email">E-mail professionnel</label><input id="staff-email" name="email" type="email" autoComplete="username" required /></div>
        <div className="field"><label htmlFor="staff-password">Mot de passe</label><input id="staff-password" name="password" type="password" autoComplete="current-password" required /></div>
        {error && <p className="alert alert-err" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={pending}>{pending ? 'Connexion en cours…' : 'Se connecter'} <ArrowRight /></button>
      </form><Link href="/" className="staff-login__back">← Retour au site Bricoloc</Link>
    </div>
  </div>;
}
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <StaffProvider><Shell>{children}</Shell></StaffProvider>;
}
