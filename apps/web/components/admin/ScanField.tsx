'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Champ de scan universel pour le back-office / la borne.
 * - Saisie directe (douchette USB / Zebra DataWedge = rafale + Entrée).
 * - Bouton caméra (BarcodeDetector natif si dispo, sinon message).
 * - Capture clavier-wedge globale : une rafale rapide finissant par Entrée
 *   alors qu'aucun champ texte n'a le focus déclenche aussi `onScan`.
 */
export function ScanField({
  onScan,
  placeholder = 'Scanner ou taper un code…',
  autoFocus = true,
}: {
  onScan: (code: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [camera, setCamera] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Capture clavier-wedge globale.
  useEffect(() => {
    let buf = '';
    let last = 0;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const now = Date.now();
      if (now - last > 120) buf = '';
      last = now;
      if (e.key === 'Enter') {
        if (buf.length >= 3) {
          onScan(buf.trim());
          buf = '';
        }
        return;
      }
      if (e.key.length === 1) buf += e.key;
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onScan]);

  // Caméra : BarcodeDetector natif (Chrome/Android/Zebra) sinon ZXing (Safari/iOS).
  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let zxingControls: { stop: () => void } | null = null;

    const hit = (raw: string) => {
      if (stopped) return;
      onScan(raw.trim());
      setCamera(false);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError(
          window.isSecureContext
            ? 'Caméra indisponible sur ce navigateur. Utilisez une douchette ou la saisie manuelle.'
            : 'La caméra exige une connexion sécurisée (HTTPS). Elle fonctionnera sur le site en ligne. En attendant : douchette ou saisie manuelle.',
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      } catch {
        setCamError('Accès caméra refusé. Autorisez la caméra dans les réglages du navigateur.');
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      const BD = (
        window as unknown as {
          BarcodeDetector?: new (o?: unknown) => { detect: (s: unknown) => Promise<{ rawValue: string }[]> };
        }
      ).BarcodeDetector;

      if (BD) {
        const detector = new BD({
          formats: ['qr_code', 'code_128', 'ean_13', 'code_39', 'data_matrix'],
        });
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) return hit(codes[0].rawValue);
          } catch {
            /* ignore */
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
        return;
      }

      // Repli ZXing (iOS Safari, Firefox…)
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        zxingControls = await reader.decodeFromStream(
          stream,
          videoRef.current!,
          (res) => {
            if (res) hit(res.getText());
          },
        );
      } catch (e) {
        console.warn('[scan] ZXing:', (e as Error).message);
        setCamError('Lecture caméra impossible. Utilisez une douchette ou la saisie manuelle.');
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      zxingControls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camera, onScan]);

  function submit() {
    const v = value.trim();
    if (v.length >= 2) {
      onScan(v);
      setValue('');
      inputRef.current?.focus();
    }
  }

  return (
    <>
      <div className="counter-scan">
        <span aria-hidden style={{ fontSize: '1.6rem' }}>⌗</span>
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button type="button" className="btn btn-primary" onClick={submit}>
          Valider
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => { setCamError(null); setCamera(true); }}>
          📷 Caméra
        </button>
      </div>

      {camera && (
        <div className="scan-camera" onClick={() => setCamera(false)}>
          {camError ? (
            <p className="alert alert-warn" style={{ maxWidth: 400 }}>{camError}</p>
          ) : (
            <>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} playsInline muted />
              <p style={{ color: '#fff' }}>Visez le QR code ou le code-barres…</p>
            </>
          )}
          <button className="btn btn-ghost" onClick={() => setCamera(false)}>
            Fermer
          </button>
        </div>
      )}
    </>
  );
}
