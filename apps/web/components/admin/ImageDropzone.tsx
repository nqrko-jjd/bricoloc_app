'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { API_URL } from '@/lib/api';

interface UploadedMedia {
  id: string;
  url: string;
  thumbUrl: string;
}

/**
 * Zone de dépôt d'images pour le back-office (fiche produit, contenus…).
 * - glisser-déposer OU clic pour choisir plusieurs fichiers
 * - téléverse vers /api/admin/uploads (conversion WebP + vignette côté API)
 * - réordonner par glisser, définir l'image principale (1re), supprimer
 * Contrôlé : `value` = tableau d'URLs, `onChange` à chaque modification.
 */
export function ImageDropzone({
  value,
  onChange,
  max = 12,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragIndex = useRef<number | null>(null);

  const staffToken = () =>
    typeof window === 'undefined' ? null : localStorage.getItem('bricoloc_staff_token');

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith('image/') || true);
      if (list.length === 0) return;
      const room = max - value.length;
      if (room <= 0) {
        setError(`Maximum ${max} images`);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const fd = new FormData();
        for (const f of list.slice(0, room)) fd.append('files', f);
        const res = await fetch(`${API_URL}/api/admin/uploads`, {
          method: 'POST',
          headers: staffToken() ? { authorization: `Bearer ${staffToken()}` } : {},
          body: fd,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? `Erreur ${res.status}`);
        const urls = (json.media as UploadedMedia[]).map((m) => m.url);
        onChange([...value, ...urls]);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [max, onChange, value],
  );

  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x!);
    onChange(next);
  }

  return (
    <div className="dropzone-wrap">
      <div
        className={`dropzone${dragOver ? ' is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <p>
          {busy ? 'Téléversement…' : 'Glissez des images ici ou cliquez pour choisir'}
          <br />
          <span className="small muted">
            JPG / PNG / WebP · converties en WebP · {value.length}/{max}
          </span>
        </p>
      </div>

      {error && <p className="alert alert-err small">{error}</p>}

      {value.length > 0 && (
        <ul className="dropzone-grid">
          {value.map((url, i) => (
            <li
              key={url}
              className="dz-item"
              draggable
              onDragStart={() => (dragIndex.current = i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex.current !== null) move(dragIndex.current, i);
                dragIndex.current = null;
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url.replace(/\.webp$/, '.thumb.webp')} alt="" loading="lazy" />
              {i === 0 && <span className="dz-badge">Principale</span>}
              <div className="dz-actions">
                <button type="button" title="Déplacer à gauche" onClick={() => move(i, i - 1)}>
                  ‹
                </button>
                <button type="button" title="Définir comme principale" onClick={() => move(i, 0)}>
                  ★
                </button>
                <button type="button" title="Déplacer à droite" onClick={() => move(i, i + 1)}>
                  ›
                </button>
                <button
                  type="button"
                  title="Supprimer"
                  className="dz-del"
                  onClick={() => removeAt(i)}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
