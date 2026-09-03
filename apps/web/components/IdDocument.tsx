'use client';

import { useEffect, useRef, useState } from 'react';
import { API_URL, uploadFile } from '@/lib/api';
import { useSession } from '@/lib/providers';

type Status = 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';

/**
 * Carte d'identité (recto) du client. Obligatoire pour commander.
 * S'appuie sur `session.user.idDocStatus`. `compact` = version panier/commande.
 */
export function IdDocument({
  compact = false,
  onUploaded,
}: {
  compact?: boolean;
  onUploaded?: () => void;
}) {
  const { user, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const status = (user?.idDocStatus ?? 'NONE') as Status;
  const stamp = user?.idDocUploadedAt ?? '';

  // Le fichier est protégé (Bearer) : on le récupère en blob pour l'afficher.
  useEffect(() => {
    if (!user || status === 'NONE') {
      setImgUrl(null);
      return;
    }
    let revoked: string | null = null;
    const token = localStorage.getItem('bricoloc_token');
    fetch(`${API_URL}/api/account/id-document/file`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (b) {
          revoked = URL.createObjectURL(b);
          setImgUrl(revoked);
        }
      })
      .catch(() => {});
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [user, status, stamp]);

  if (!user) return null;

  async function onFile(file: File) {
    setErr('');
    if (!file.type.startsWith('image/')) {
      setErr('Choisissez une photo (JPEG ou PNG).');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setErr('Fichier trop lourd (12 Mo maximum).');
      return;
    }
    setBusy(true);
    try {
      await uploadFile('/api/account/id-document', file);
      await refresh();
      onUploaded?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Échec de l’envoi.');
    } finally {
      setBusy(false);
    }
  }

  const pick = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'Envoi…' : status === 'NONE' ? 'Ajouter ma carte d’identité' : 'Remplacer la photo'}
      </button>
    </>
  );

  return (
    <div className={compact ? 'stack' : 'card card-pad stack'}>
      {!compact && <h3>Pièce d’identité</h3>}

      {status === 'VERIFIED' && (
        <p className="alert alert-ok" style={{ margin: 0 }}>
          Carte d’identité vérifiée ✓
        </p>
      )}
      {status === 'PENDING' && (
        <p className="alert alert-info" style={{ margin: 0 }}>
          Carte d’identité reçue — validation par notre équipe. Vous pouvez continuer votre commande.
        </p>
      )}
      {status === 'REJECTED' && (
        <p className="alert alert-warn" style={{ margin: 0 }}>
          Photo refusée{user.idDocReviewNote ? ` : ${user.idDocReviewNote}` : ''}. Merci d’en envoyer
          une nouvelle, nette et entièrement visible.
        </p>
      )}
      {status === 'NONE' && (
        <p className="small muted" style={{ margin: 0 }}>
          Pour louer du matériel, une photo du <strong>recto</strong> de la carte d’identité de la
          personne qui commande est nécessaire (caution &amp; contrat de location).
        </p>
      )}

      {imgUrl && (
        <img
          src={imgUrl}
          alt="Carte d’identité"
          style={{ maxWidth: 260, borderRadius: 10, border: '1px solid var(--border)' }}
        />
      )}

      {status !== 'VERIFIED' && pick}
      {err && (
        <p className="alert alert-warn" style={{ margin: 0 }}>
          {err}
        </p>
      )}

      <p className="small muted" style={{ margin: 0 }}>
        Document confidentiel, réservé à l’équipe Bricoloc, conservé le temps de la relation de
        location puis supprimé.
      </p>
    </div>
  );
}
