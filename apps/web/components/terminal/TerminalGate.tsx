'use client';
import { StaffProvider, useStaff } from '@/lib/staff';
import { Logo } from '@/components/Logo';

function Gate({ children }: { children: React.ReactNode }) {
  const { staff, loading, login, logout } = useStaff();

  if (loading) {
    return (
      <div className="term-shell term-center">
        <span className="spinner" />
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="term-shell term-center">
        <div className="term-login">
          <Logo />
          <h1>Terminal équipe</h1>
          <form
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
            <input name="email" type="email" placeholder="E-mail" required autoComplete="username" />
            <input
              name="password"
              type="password"
              placeholder="Mot de passe"
              required
              autoComplete="current-password"
            />
            <button className="btn btn-primary btn-block btn-lg">Se connecter</button>
          </form>
          <p className="small muted">Démo : comptoir@bricoloc.example · bricoloc</p>
        </div>
      </div>
    );
  }

  return (
    <div className="term-shell">
      <header className="term-top">
        <Logo />
        <button className="term-logout" onClick={logout}>
          {staff.name?.split(' ')[0] ?? 'Équipe'} · Quitter
        </button>
      </header>
      {children}
    </div>
  );
}

export function TerminalGate({ children }: { children: React.ReactNode }) {
  return (
    <StaffProvider>
      <Gate>{children}</Gate>
    </StaffProvider>
  );
}
