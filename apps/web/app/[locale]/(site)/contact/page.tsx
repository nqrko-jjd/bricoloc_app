'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { PublicConfig } from '@/lib/types';

export default function ContactPage() {
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [f, setF] = useState({ name: '', email: '', phone: '', message: '' });
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<PublicConfig>('/api/public/config').then(setCfg).catch(() => {});
  }, []);

  return (
    <div className="section container" style={{ maxWidth: 720 }}>
      <h1>Contact</h1>
      <div className="two-col">
        <form
          className="card card-pad stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr('');
            try {
              await api('/api/public/contact', { method: 'POST', body: f });
              setSent(true);
            } catch (e) {
              setErr(e instanceof Error ? e.message : 'Envoi impossible');
            }
          }}
        >
          {sent ? (
            <div className="alert alert-ok">Message envoyé. Nous revenons vers vous rapidement.</div>
          ) : (
            <>
              {err && <div className="alert alert-err">{err}</div>}
              <div className="field">
                <label>Nom</label>
                <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              </div>
              <div className="field-2">
                <div className="field">
                  <label>E-mail</label>
                  <input
                    type="email"
                    required
                    value={f.email}
                    onChange={(e) => setF({ ...f, email: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Téléphone</label>
                  <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>Message</label>
                <textarea
                  required
                  rows={5}
                  value={f.message}
                  onChange={(e) => setF({ ...f, message: e.target.value })}
                />
              </div>
              <button className="btn btn-primary">Envoyer</button>
            </>
          )}
        </form>
        <div className="card card-pad">
          <h3>BRICOLOC</h3>
          {cfg?.company ? (
            <ul className="small" style={{ paddingLeft: 16 }}>
              <li>{cfg.company.legalName}</li>
              <li>{cfg.company.address}</li>
              <li>{cfg.company.phone}</li>
              <li>{cfg.company.email}</li>
              <li>TVA {cfg.company.vatNumber}</li>
            </ul>
          ) : (
            <p className="small muted">Coordonnées à compléter dans l&apos;administration.</p>
          )}
          <p className="small muted">Coordonnées de démonstration — fictives.</p>
        </div>
      </div>
    </div>
  );
}
