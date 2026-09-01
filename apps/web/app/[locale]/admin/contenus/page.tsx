'use client';
import { useEffect, useMemo, useState } from 'react';
import { staffApi } from '@/lib/staff';

/* eslint-disable @typescript-eslint/no-explicit-any */
const LOCALES = ['fr', 'nl', 'en'] as const;

export default function AdminContenus() {
  const [rows, setRows] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [key, setKey] = useState<string | null>(null);
  const [locale, setLocale] = useState<'fr' | 'nl' | 'en'>('fr');
  const [draft, setDraft] = useState({ title: '', body: '', format: 'markdown' as 'markdown' | 'html' });
  const [msg, setMsg] = useState('');

  async function load() {
    const [c, r] = await Promise.all([
      staffApi<{ content: any[] }>('/api/admin/content'),
      staffApi<{ reviews: any[] }>('/api/admin/reviews?status=PENDING'),
    ]);
    setRows(c.content);
    setReviews(r.reviews);
  }
  useEffect(() => {
    load();
  }, []);

  const keys = useMemo(() => [...new Set(rows.map((r) => r.key))].sort(), [rows]);
  const current = rows.find((r) => r.key === key && r.locale === locale);
  const frVersion = rows.find((r) => r.key === key && r.locale === 'fr');

  useEffect(() => {
    if (current) setDraft({ title: current.title ?? '', body: current.body ?? '', format: current.format ?? 'markdown' });
    else setDraft({ title: frVersion?.title ?? '', body: '', format: 'markdown' });
  }, [key, locale, rows]); // eslint-disable-line

  async function save() {
    await staffApi('/api/admin/content', {
      method: 'PUT',
      body: { key, locale, title: draft.title, body: draft.body, format: draft.format },
    });
    setMsg(locale === 'fr' ? 'Enregistré — traduction NL/EN relancée.' : 'Version ' + locale.toUpperCase() + ' figée (plus de traduction auto).');
    await load();
  }

  return (
    <div className="stack">
      <h1>Contenus du site</h1>

      {reviews.length > 0 && (
        <div className="card card-body">
          <h3>Avis à modérer <span className="badge badge-warn">{reviews.length}</span></h3>
          {reviews.map((rv) => (
            <div key={rv.id} className="line small" style={{ alignItems: 'flex-start' }}>
              <span>
                <strong>{rv.authorName}</strong> · {rv.rating}★ · {rv.product?.name}
                <br />
                {rv.title ? <em>{rv.title} — </em> : null}
                {rv.body}
              </span>
              <span className="row">
                <button className="btn btn-outline btn-sm"
                  onClick={async () => { await staffApi(`/api/admin/reviews/${rv.id}`, { method: 'PATCH', body: { status: 'PUBLISHED' } }); load(); }}>
                  Publier
                </button>
                <button className="btn btn-ghost btn-sm"
                  onClick={async () => { await staffApi(`/api/admin/reviews/${rv.id}`, { method: 'PATCH', body: { status: 'REJECTED' } }); load(); }}>
                  Rejeter
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {msg && <div className="alert alert-ok">{msg}</div>}

      <div className="two-col">
        <div className="card card-body">
          <h3>Clés de contenu</h3>
          <ul className="dash-queue">
            {keys.map((k) => (
              <li key={k}>
                <button className="btn btn-ghost btn-sm" style={{ textAlign: 'left' }}
                  onClick={() => setKey(k)}>
                  {k}
                  {!rows.find((r) => r.key === k && r.locale === 'nl') && (
                    <span className="badge badge-warn" style={{ marginLeft: 6 }}>NL/EN manquant</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <button className="btn btn-outline btn-sm"
            onClick={() => { const k = prompt('Nouvelle clé (ex : home.hero.title)'); if (k) { setKey(k); setLocale('fr'); } }}>
            + Nouvelle clé
          </button>
        </div>

        {key && (
          <div className="card card-pad stack">
            <div className="spread">
              <h3>{key}</h3>
              <div className="lang-switch">
                {LOCALES.map((l) => (
                  <button key={l} className={l === locale ? 'is-active' : ''} onClick={() => setLocale(l)}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {locale !== 'fr' && current?.autoTranslated && (
              <div className="alert alert-info small">Traduction automatique DeepL — modifiez pour la figer.</div>
            )}

            <label className="field">Titre
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
            <label className="field">
              Contenu ({draft.format})
              <textarea rows={12} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-sans)' }} />
            </label>
            <div className="row">
              <select value={draft.format} onChange={(e) => setDraft({ ...draft, format: e.target.value as any })}>
                <option value="markdown">Markdown</option>
                <option value="html">HTML</option>
              </select>
              <button className="btn btn-primary btn-sm" onClick={save}>Enregistrer</button>
              {locale === 'fr' && (
                <button className="btn btn-outline btn-sm"
                  onClick={async () => {
                    const r = await staffApi<{ translated: string[] }>(`/api/admin/content/${encodeURIComponent(key)}/retranslate`, { method: 'POST' });
                    setMsg(`Retraduit : ${r.translated.join(', ') || 'aucune (déjà à jour ou révisé)'}.`);
                    await load();
                  }}>
                  Retraduire NL/EN
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
