'use client';
import { Link } from '@/i18n/navigation';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/providers';

export default function ConnexionPage() {
  const { login } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await login(email, password);
      router.push('/compte');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Connexion impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="section container" style={{ maxWidth: 440 }}>
      <h1>Connexion</h1>
      <form className="card card-pad stack" onSubmit={submit}>
        {err && <div className="alert alert-err">{err}</div>}
        <div className="field">
          <label>E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? '…' : 'Se connecter'}
        </button>
        <p className="small muted">
          Pas de compte ? <Link href="/inscription">Créer un compte</Link>
        </p>
        <p className="small muted">
          Démo : <code>client@bricoloc.example</code> / <code>bricoloc</code>
        </p>
      </form>
    </div>
  );
}
