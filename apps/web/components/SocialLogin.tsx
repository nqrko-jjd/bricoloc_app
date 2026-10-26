'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useSession } from '@/lib/providers';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
    AppleID?: any;
  }
}

interface SocialCfg {
  google: string | null;
  apple: string | null;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('script'));
    document.head.appendChild(s);
  });
}

/**
 * Boutons « Continuer avec Google / Apple ». Un bouton n'apparaît que si son
 * identifiant client est configuré côté serveur (GOOGLE_CLIENT_ID /
 * APPLE_CLIENT_ID) : sans configuration, le composant ne rend rien.
 */
export function SocialLogin({ redirectTo = '/compte' }: { redirectTo?: string }) {
  const router = useRouter();
  const { setToken } = useSession();
  const [cfg, setCfg] = useState<SocialCfg | null>(null);
  const [err, setErr] = useState('');
  const googleBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ socialLogin?: SocialCfg }>('/api/public/config')
      .then((c) => setCfg(c.socialLogin ?? null))
      .catch(() => setCfg(null));
  }, []);

  async function finish(path: string, body: Record<string, unknown>) {
    setErr('');
    try {
      const res = await api<{ token: string }>(path, { method: 'POST', body });
      await setToken(res.token);
      router.push(redirectTo);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Connexion impossible');
    }
  }

  // Bouton officiel Google (affiche le compte déjà connecté dans le navigateur).
  useEffect(() => {
    const clientId = cfg?.google;
    if (!clientId) return;
    let cancelled = false;
    loadScript('https://accounts.google.com/gsi/client')
      .then(() => {
        if (cancelled || !window.google || !googleBox.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (r: { credential: string }) =>
            void finish('/api/auth/social/google', { credential: r.credential }),
        });
        window.google.accounts.id.renderButton(googleBox.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: Math.min(googleBox.current.clientWidth || 360, 400),
          locale: 'fr',
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.google]);

  async function apple() {
    if (!cfg?.apple) return;
    setErr('');
    try {
      await loadScript(
        'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/fr_FR/appleid.auth.js',
      );
      window.AppleID.auth.init({
        clientId: cfg.apple,
        scope: 'name email',
        redirectURI: window.location.origin,
        usePopup: true,
      });
      const r = await window.AppleID.auth.signIn();
      await finish('/api/auth/social/apple', {
        idToken: r.authorization.id_token,
        name: r.user?.name,
      });
    } catch (e: any) {
      // Fenêtre fermée par le client : pas une erreur à afficher.
      if (e?.error !== 'popup_closed_by_user') setErr('Connexion Apple impossible');
    }
  }

  if (!cfg || (!cfg.google && !cfg.apple)) return null;

  return (
    <div className="stack" style={{ gap: 10 }}>
      {err && <div className="alert alert-err">{err}</div>}
      {cfg.google && <div ref={googleBox} style={{ display: 'flex', justifyContent: 'center' }} />}
      {cfg.apple && (
        <button
          type="button"
          onClick={apple}
          className="btn btn-block"
          style={{ background: '#000', color: '#fff', borderColor: '#000' }}
        >
          <svg
            aria-hidden="true"
            width="16"
            height="18"
            viewBox="0 0 814 1000"
            fill="currentColor"
            style={{ marginRight: 8, verticalAlign: '-2px' }}
          >
            <path d="M788 340c-6 5-110 63-110 193 0 150 132 203 136 204-1 3-21 72-70 143-43 62-88 124-157 124s-86-40-165-40c-77 0-104 41-167 41s-106-58-157-129C56 779 0 662 0 551c0-179 117-274 232-274 61 0 112 40 150 40 36 0 93-43 162-43 26 0 120 2 183 90zM554 160c29-34 50-82 50-130 0-7-1-14-2-19-48 2-105 32-139 71-27 30-52 78-52 127 0 7 1 15 2 17 3 1 8 1 12 1 43 0 97-29 129-67z" />
          </svg>
          Continuer avec Apple
        </button>
      )}
      <div className="small muted" style={{ textAlign: 'center' }}>
        — ou avec votre e-mail —
      </div>
    </div>
  );
}
