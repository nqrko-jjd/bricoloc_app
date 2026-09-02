'use client';
import { useState } from 'react';
import { API_URL } from '@/lib/api';
import { staffApi, useStaff } from '@/lib/staff';

/* eslint-disable @typescript-eslint/no-explicit-any */

const ENTITIES = [
  { key: 'products', label: 'Produits (machines, accessoires, EPI, packs)', canImport: true, cols: 'slug, name, kind, categorySlug, dailyPrice, deposit, stockQty, published…' },
  { key: 'consumables', label: 'Consommables', canImport: true, cols: 'slug, name, categorySlug, unitPrice, stockQty, partSupplier, supplierRef…' },
  { key: 'units', label: 'Inventaire — exemplaires', canImport: true, cols: 'assetTag, productSlug, state, serialNumber, sku, barcode, notes' },
  { key: 'clients', label: 'Clients', canImport: true, cols: 'email, firstName, lastName, phone, customerType, companyName, vatNumber' },
  { key: 'reservations', label: 'Commandes / réservations', canImport: false, cols: '' },
] as const;

const ACTION_LABEL: Record<string, string> = {
  create: 'création',
  update: 'mise à jour',
  skip: 'inchangé',
  error: 'erreur',
};

export default function ImportExportPage() {
  const { token } = useStaff();
  const [busy, setBusy] = useState('');
  const [entity, setEntity] = useState<string>('products');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');

  async function download(key: string) {
    setBusy(key);
    setErr('');
    try {
      const res = await fetch(`${API_URL}/api/admin/io/export/${key}`, {
        headers: { authorization: `Bearer ${token() ?? ''}` },
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bricoloc-${key}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Téléchargement impossible');
    } finally {
      setBusy('');
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setCsvText(await f.text());
    setPreview(null);
    setDone('');
    setErr('');
  }

  async function run(commit: boolean) {
    if (!csvText.trim()) {
      setErr('Choisissez un fichier CSV.');
      return;
    }
    setBusy(commit ? 'commit' : 'preview');
    setErr('');
    setDone('');
    try {
      const r = await staffApi<any>(`/api/admin/io/import/${entity}`, {
        method: 'POST',
        body: { csv: csvText, commit },
      });
      setPreview(r);
      if (commit) {
        const s = r.summary ?? {};
        setDone(
          `Import terminé : ${s.create ?? 0} création(s), ${s.update ?? 0} mise(s) à jour, ${s.skip ?? 0} inchangé(s), ${s.error ?? 0} erreur(s).`,
        );
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Import impossible');
      setPreview(null);
    } finally {
      setBusy('');
    }
  }

  const current = ENTITIES.find((x) => x.key === entity)!;
  const hasErrors = preview?.results?.some((x: any) => x.action === 'error');

  return (
    <div className="section">
      <h1>Import / export CSV</h1>
      <p className="muted" style={{ maxWidth: 640 }}>
        Exportez n&apos;importe quelle liste au format CSV (ouvrable dans Excel / LibreOffice /
        Google Sheets), modifiez-la, puis réimportez-la. L&apos;import se fait toujours en deux
        temps : un <strong>aperçu</strong> détaillé, puis l&apos;application.
      </p>

      {err && <div className="alert alert-err">{err}</div>}
      {done && <div className="alert alert-ok">{done}</div>}

      {/* ---------- EXPORT ---------- */}
      <section className="card card-pad" style={{ marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Exporter</h2>
        <div className="io-grid">
          {ENTITIES.map((x) => (
            <button
              key={x.key}
              className="btn btn-outline"
              disabled={busy === x.key}
              onClick={() => download(x.key)}
            >
              {busy === x.key ? '…' : `↓ ${x.label}`}
            </button>
          ))}
        </div>
      </section>

      {/* ---------- IMPORT ---------- */}
      <section className="card card-pad" style={{ marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Importer</h2>

        <div className="field">
          <label>Type de données</label>
          <select
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setPreview(null);
              setDone('');
            }}
          >
            {ENTITIES.filter((x) => x.canImport).map((x) => (
              <option key={x.key} value={x.key}>
                {x.label}
              </option>
            ))}
          </select>
        </div>

        <p className="small muted">
          Clé d&apos;identification :{' '}
          <code>{entity === 'clients' ? 'email' : entity === 'units' ? 'assetTag' : 'slug'}</code>{' '}
          — les lignes existantes sont mises à jour, les nouvelles sont créées. Seules les colonnes
          présentes dans le fichier sont modifiées.
          <br />
          Colonnes reconnues : <code>{current.cols}</code>
        </p>
        <p className="small muted">
          Astuce : exportez d&apos;abord la liste ci-dessus pour partir du bon modèle de colonnes.
        </p>

        <div className="field">
          <label>Fichier CSV</label>
          <input type="file" accept=".csv,text/csv" onChange={onFile} />
          {fileName && <span className="small muted">{fileName}</span>}
        </div>

        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-outline" disabled={!csvText || busy === 'preview'} onClick={() => run(false)}>
            {busy === 'preview' ? 'Analyse…' : 'Aperçu'}
          </button>
          <button
            className="btn btn-primary"
            disabled={!preview || preview.commit || busy === 'commit' || hasErrors}
            onClick={() => run(true)}
            title={hasErrors ? 'Corrigez les erreurs avant d’appliquer' : undefined}
          >
            {busy === 'commit' ? 'Application…' : 'Appliquer'}
          </button>
        </div>

        {preview && (
          <div style={{ marginTop: 18 }}>
            <div className="io-summary">
              {['create', 'update', 'skip', 'error'].map((k) => (
                <span key={k} data-k={k}>
                  {ACTION_LABEL[k]} : <strong>{preview.summary?.[k] ?? 0}</strong>
                </span>
              ))}
            </div>
            {hasErrors && !preview.commit && (
              <p className="small" style={{ color: 'var(--danger, #c0392b)' }}>
                Des lignes sont en erreur : elles seront ignorées. Corrigez le fichier pour les inclure.
              </p>
            )}
            <div className="io-table-wrap">
              <table className="io-table">
                <thead>
                  <tr>
                    <th>Ligne</th>
                    <th>Action</th>
                    <th>Clé</th>
                    <th>Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.results.slice(0, 400).map((r: any, i: number) => (
                    <tr key={i} data-k={r.action}>
                      <td>{r.line}</td>
                      <td>{ACTION_LABEL[r.action]}</td>
                      <td>
                        <code>{r.key || '—'}</code>
                      </td>
                      <td>
                        {r.message
                          ? r.message
                          : r.changes && r.changes.length
                            ? r.changes.join(', ')
                            : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.results.length > 400 && (
                <p className="small muted">… {preview.results.length - 400} lignes de plus</p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
