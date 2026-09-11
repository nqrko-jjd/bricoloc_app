'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { API_URL } from '@/lib/api';

interface UploadedDocument {
  id: string;
  url: string;
  originalName: string;
}

type DocRow = { label: string; url: string };

/**
 * Notice (mode d'emploi) + documents complémentaires (fiche technique,
 * déclaration de conformité…) d'une fiche produit. PDF / Word / Excel,
 * téléversés vers /api/admin/uploads/documents (stockés tels quels, pas de
 * conversion contrairement aux images).
 */
export function DocumentUploader({
  manualUrl,
  onManualUrlChange,
  documents,
  onDocumentsChange,
}: {
  manualUrl: string;
  onManualUrlChange: (url: string) => void;
  documents: DocRow[];
  onDocumentsChange: (docs: DocRow[]) => void;
}) {
  const manualInputRef = useRef<HTMLInputElement>(null);
  const docsInputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [busy, setBusy] = useState<'manual' | 'docs' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const staffToken = () =>
    typeof window === 'undefined' ? null : localStorage.getItem('bricoloc_staff_token');

  const upload = useCallback(async (files: FileList | File[]): Promise<UploadedDocument[]> => {
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append('files', f);
    const res = await fetch(`${API_URL}/api/admin/uploads/documents`, {
      method: 'POST',
      headers: staffToken() ? { authorization: `Bearer ${staffToken()}` } : {},
      body: fd,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message ?? `Erreur ${res.status}`);
    return json.documents as UploadedDocument[];
  }, []);

  async function pickManual(files: FileList | null) {
    if (!files?.length) return;
    setBusy('manual');
    setError(null);
    try {
      const [doc] = await upload([files[0]!]);
      if (doc) onManualUrlChange(doc.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function pickDocs(files: FileList | null) {
    if (!files?.length) return;
    setBusy('docs');
    setError(null);
    try {
      const uploaded = await upload(files);
      const rows = uploaded.map((d) => ({
        label: d.originalName.replace(/\.[^.]+$/, ''),
        url: d.url,
      }));
      onDocumentsChange([...documents, ...rows]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function updateLabel(i: number, label: string) {
    onDocumentsChange(documents.map((d, idx) => (idx === i ? { ...d, label } : d)));
  }
  function removeDoc(i: number) {
    onDocumentsChange(documents.filter((_, idx) => idx !== i));
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="field">
        <label>Notice / mode d&apos;emploi</label>
        {manualUrl ? (
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <a href={manualUrl} target="_blank" rel="noreferrer" className="small">
              📄 Voir la notice actuelle
            </a>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onManualUrlChange('')}
            >
              Retirer
            </button>
          </div>
        ) : (
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => manualInputRef.current?.click()}
              disabled={busy === 'manual'}
            >
              {busy === 'manual' ? 'Téléversement…' : '📎 Joindre la notice (PDF)'}
            </button>
            <span className="small muted">ou collez un lien :</span>
            <input
              placeholder="https://…"
              value={manualUrl}
              onChange={(e) => onManualUrlChange(e.target.value)}
              style={{ flex: 1, minWidth: 160 }}
            />
          </div>
        )}
        <input
          ref={manualInputRef}
          id={`${inputId}-manual`}
          type="file"
          accept="application/pdf,.pdf,.doc,.docx"
          hidden
          onChange={(e) => {
            pickManual(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div className="field">
        <label>Autres documents (fiche technique, déclaration de conformité…)</label>
        {documents.length > 0 && (
          <ul className="stack" style={{ gap: 6, marginBottom: 8 }}>
            {documents.map((d, i) => (
              <li key={d.url} className="row" style={{ gap: 8, alignItems: 'center' }}>
                <a href={d.url} target="_blank" rel="noreferrer" className="small" title="Ouvrir">
                  📄
                </a>
                <input
                  value={d.label}
                  onChange={(e) => updateLabel(i, e.target.value)}
                  placeholder="Nom du document"
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeDoc(i)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => docsInputRef.current?.click()}
          disabled={busy === 'docs'}
        >
          {busy === 'docs' ? 'Téléversement…' : '+ Ajouter un document (PDF, Word, Excel)'}
        </button>
        <input
          ref={docsInputRef}
          id={`${inputId}-docs`}
          type="file"
          accept="application/pdf,.pdf,.doc,.docx,.xls,.xlsx"
          multiple
          hidden
          onChange={(e) => {
            pickDocs(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {error && <p className="alert alert-err small">{error}</p>}
    </div>
  );
}
