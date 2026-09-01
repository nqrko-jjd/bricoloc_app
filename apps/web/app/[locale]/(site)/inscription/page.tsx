'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/providers';

export default function InscriptionPage() {
  const { register } = useSession();
  const router = useRouter();
  const [f, setF] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    customerType: 'PARTICULIER',
    companyName: '',
    vatNumber: '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await register(f);
      router.push('/compte');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Inscription impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="section container" style={{ maxWidth: 520 }}>
      <h1>Créer un compte</h1>
      <form className="card card-pad stack" onSubmit={submit}>
        {err && <div className="alert alert-err">{err}</div>}
        <div className="pill-row">
          {['PARTICULIER', 'PRO'].map((t) => (
            <button
              type="button"
              key={t}
              className={`chip${f.customerType === t ? ' active' : ''}`}
              onClick={() => set('customerType', t)}
            >
              {t === 'PARTICULIER' ? 'Particulier' : 'Professionnel'}
            </button>
          ))}
        </div>
        <div className="field-2">
          <div className="field">
            <label>Prénom</label>
            <input value={f.firstName} onChange={(e) => set('firstName', e.target.value)} required />
          </div>
          <div className="field">
            <label>Nom</label>
            <input value={f.lastName} onChange={(e) => set('lastName', e.target.value)} required />
          </div>
        </div>
        <div className="field-2">
          <div className="field">
            <label>E-mail</label>
            <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} required />
          </div>
          <div className="field">
            <label>Téléphone</label>
            <input value={f.phone} onChange={(e) => set('phone', e.target.value)} required />
          </div>
        </div>
        {f.customerType === 'PRO' && (
          <div className="field-2">
            <div className="field">
              <label>Société</label>
              <input value={f.companyName} onChange={(e) => set('companyName', e.target.value)} />
            </div>
            <div className="field">
              <label>N° TVA</label>
              <input value={f.vatNumber} onChange={(e) => set('vatNumber', e.target.value)} />
            </div>
          </div>
        )}
        <div className="field">
          <label>Mot de passe (8 caractères min.)</label>
          <input
            type="password"
            value={f.password}
            onChange={(e) => set('password', e.target.value)}
            required
            minLength={8}
          />
        </div>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? '…' : 'Créer mon compte'}
        </button>
      </form>
    </div>
  );
}
