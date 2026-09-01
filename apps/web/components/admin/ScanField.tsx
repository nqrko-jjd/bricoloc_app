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

  // Caméra + BarcodeDetector.
  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    (async () => {
      const BD = (window as unknown as { BarcodeDetector?: new (o?: unknown) => { detect: (s: unknown) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      if (!BD) {
        setCamError('La lecture caméra n’est pas prise en charge par ce navigateur. Utilisez une douchette ou la saisie manuelle.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new BD({
          formats: ['qr_code', 'code_128', 'ean_13', 'code_39', 'data_matrix'],
        });
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) {
              onScan(codes[0].rawValue.trim());
              setCamera(false);
              return;
            }
          } catch {
            /* ignore */
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setCamError('Accès caméra refusé.');
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
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
