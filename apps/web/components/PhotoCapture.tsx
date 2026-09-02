'use client';

import { useRef, useState } from 'react';
import { API_URL } from '@/lib/api';
import { useStaff } from '@/lib/staff';

/**
 * Prise de photos (état du matériel à la sortie / au retour).
 * Sur le Zebra / un smartphone, ouvre directement l'appareil photo.
 * Les images sont redimensionnées côté serveur (endpoint /api/admin/uploads).
 */
export function PhotoCapture({
  urls,
  onChange,
  label = 'Ajouter une photo',
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  label?: string;
}) {
  const { token } = useStaff();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    setErr('');
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      const res = await fetch(`${API_URL}/api/admin/uploads`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token() ?? ''}` },
        body: fd,
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = (await res.json()) as { media: { url: string }[] };
      onChange([...urls, ...data.media.map((m) => m.url)]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="photocap">
      <div className="photocap__grid">
        {urls.map((u, i) => (
          <div key={u} className="photocap__thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`Photo ${i + 1}`} />
            <button
              type="button"
              aria-label="Retirer"
              onClick={() => onChange(urls.filter((x) => x !== u))}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="photocap__add"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? '…' : `📷 ${label}`}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={onFiles}
      />
      {err && <p className="small" style={{ color: '#c0392b' }}>{err}</p>}
    </div>
  );
}
