'use client';
import { useEffect, useMemo, useState } from 'react';
import { staffApi } from '@/lib/staff';

/* eslint-disable @typescript-eslint/no-explicit-any */
const LOCALES = ['fr', 'nl', 'en'] as const;

/** Où chaque clé de contenu apparaît réellement sur le site — pour que la
 * liste montre une page qu'on reconnaît, pas une clé technique. Une clé qui
 * n'est plus dans ce registre n'est plus lue par aucune page : elle est
 * signalée comme orpheline (modifiable mais sans aucun effet visible). */
const REGISTRY: Record<string, { label: string; href: string }> = {
  'how-it-works': { label: 'Page « Comment ça marche »', href: '/fonctionnement' },
  faq: { label: 'Page FAQ', href: '/faq' },
  delivery: { label: 'Page « Livraison »', href: '/livraison' },
  'click-collect': { label: 'Page « Click & Collect »', href: '/click-collect' },
  pro: { label: 'Page « Espace Pro »', href: '/pro' },
  legal: { label: 'Page « Mentions légales »', href: '/legal' },
};

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
  const pageKeys = keys.filter((k) => REGISTRY[k]);
  const orphanKeys = keys.filter((k) => !REGISTRY[k]);
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

  async function removeKey(k: string) {
    if (!confirm(`Supprimer la clé « ${k} » (FR/NL/EN) ? Elle n'est utilisée sur aucune page.`)) return;
    await staffApi(`/api/admin/content/${encodeURIComponent(k)}`, { method: 'DELETE' });
    if (key === k) setKey(null);
    setMsg(`Clé « ${k} » supprimée.`);
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
        <div className="card card-body stack">
          <h3>Pages éditables</h3>
          <p className="small muted" style={{ margin: 0 }}>
            Chaque ligne correspond à une vraie page du site. Cliquez pour l&apos;éditer, ou « Voir »
            pour l&apos;ouvrir telle qu&apos;elle apparaît aux visiteurs.
          </p>
          <ul className="dash-queue">
            {pageKeys.map((k) => (
              <li key={k} className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="btn btn-ghost btn-sm" style={{ textAlign: 'left', flex: 1 }}
                  onClick={() => setKey(k)}>
                  {REGISTRY[k].label}
                  {!rows.find((r) => r.key === k && r.locale === 'nl') && (
                    <span className="badge badge-warn" style={{ marginLeft: 6 }}>NL/EN manquant</span>
                  )}
                </button>
                <a href={REGISTRY[k].href} target="_blank" rel="noreferrer" className="small">
                  Voir ↗
                </a>
              </li>
            ))}
          </ul>

          {orphanKeys.length > 0 && (
            <details style={{ marginTop: 4 }}>
              <summary className="small muted" style={{ cursor: 'pointer' }}>
                {orphanKeys.length} clé(s) orpheline(s) — n&apos;apparaissent plus sur aucune page
              </summary>
              <p className="small muted">
                Restes d&apos;anciennes versions du site. Les modifier n&apos;a aucun effet visible ;
                autant les supprimer.
              </p>
              <ul className="dash-queue">
                {orphanKeys.map((k) => (
                  <li key={k} className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <button className="btn btn-ghost btn-sm" style={{ textAlign: 'left', flex: 1, fontFamily: 'monospace' }}
                      onClick={() => setKey(k)}>
                      {k}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => removeKey(k)}>Supprimer</button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <button className="btn btn-outline btn-sm"
            onClick={() => { const k = prompt('Nouvelle clé technique (ex : home.hero.title) — réservé aux cas où Claude vous en donne une'); if (k) { setKey(k); setLocale('fr'); } }}>
            + Nouvelle clé
          </button>
        </div>

        {key && (
          <div className="card card-pad stack">
            <div className="spread">
              <h3>
                {REGISTRY[key]?.label ?? key}
                {!REGISTRY[key] && <span className="badge badge-warn" style={{ marginLeft: 8 }}>orpheline</span>}
              </h3>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                {REGISTRY[key] && (
                  <a href={REGISTRY[key].href} target="_blank" rel="noreferrer" className="small">
                    Voir sur le site ↗
                  </a>
                )}
                <div className="lang-switch">
                  {LOCALES.map((l) => (
                    <button key={l} className={l === locale ? 'is-active' : ''} onClick={() => setLocale(l)}>
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
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
