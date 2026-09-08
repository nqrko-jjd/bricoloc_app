'use client';

import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';

interface MediaItem {
  id: string;
  url: string;
  thumbUrl: string;
  width: number | null;
  height: number | null;
}

/**
 * Bibliothèque de médias façon WordPress : parcourt tout ce qui a déjà été
 * téléversé (toutes fiches confondues) pour le réutiliser sans re-uploader.
 * Pas de recherche par mot-clé : les fichiers n'ont pas de nom lisible en
 * base (générés), donc uniquement un parcours visuel paginé, plus récent
 * d'abord.
 */
export function MediaLibraryPicker({
  onPick,
  onClose,
  alreadyUsed,
}: {
  onPick: (urls: string[]) => void;
  onClose: () => void;
  alreadyUsed: string[];
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const staffToken = () =>
    typeof window === 'undefined' ? null : localStorage.getItem('bricoloc_staff_token');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/admin/uploads?page=${page}&pageSize=60`, {
      headers: staffToken() ? { authorization: `Bearer ${staffToken()}` } : {},
    })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json?.error?.message ?? `Erreur ${r.status}`);
        if (cancelled) return;
        setItems(json.media as MediaItem[]);
        setTotalPages(Math.max(1, Math.ceil(json.total / json.pageSize)));
      })
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page]);

  function toggle(url: string) {
    setSelected((s) => (s.includes(url) ? s.filter((u) => u !== url) : [...s, url]));
  }

  return (
    <div className="medialib-overlay" onClick={onClose}>
      <div
        className="medialib"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="medialib__head">
          <strong>Bibliothèque de médias</strong>
          <button type="button" className="medialib__close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        <p className="small muted" style={{ margin: '0 16px' }}>
          Tout ce qui a déjà été téléversé (n'importe quelle fiche) — cliquez pour sélectionner,
          plusieurs à la fois.
        </p>

        {loading && <p className="small muted" style={{ padding: 16 }}>Chargement…</p>}
        {error && <p className="alert alert-err small" style={{ margin: 16 }}>{error}</p>}

        {!loading && !error && (
          <>
            {items.length === 0 ? (
              <p className="small muted" style={{ padding: 16 }}>Aucun média.</p>
            ) : (
              <ul className="medialib__grid">
                {items.map((m) => {
                  const used = alreadyUsed.includes(m.url);
                  const isSel = selected.includes(m.url);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        className={`medialib__item${isSel ? ' is-selected' : ''}${used ? ' is-used' : ''}`}
                        onClick={() => !used && toggle(m.url)}
                        disabled={used}
                        title={used ? 'Déjà sur cette fiche' : undefined}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.thumbUrl} alt="" loading="lazy" />
                        {isSel && <span className="medialib__check">✓</span>}
                        {used && <span className="medialib__usedTag">déjà ajoutée</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="medialib__pager">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ‹ Précédent
              </button>
              <span className="small muted">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant ›
              </button>
            </div>
          </>
        )}

        <div className="medialib__foot">
          <span className="small muted">
            {selected.length > 0 ? `${selected.length} sélectionnée(s)` : 'Aucune sélection'}
          </span>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Annuler
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={selected.length === 0}
              onClick={() => {
                onPick(selected);
                onClose();
              }}
            >
              Ajouter {selected.length > 0 ? `(${selected.length})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
