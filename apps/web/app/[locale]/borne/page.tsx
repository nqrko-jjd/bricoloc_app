'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { resetKioskSession } from '@/lib/kiosk';

export default function BorneHome() {
  const router = useRouter();
  useEffect(() => {
    resetKioskSession();
  }, []);

  return (
    <div className="kiosk-body">
      <div className="logo on-dark" style={{ fontSize: '2.4rem', marginBottom: 8 }}>
        <span className="b">BRICO</span>
        <span className="l">LOC</span>
      </div>
      <p style={{ fontSize: '1.3rem', opacity: 0.9, marginBottom: 30 }}>
        Le bon outil. Au bon moment.
      </p>
      <div className="kiosk-grid">
        <button className="kiosk-tile brico" onClick={() => router.push('/borne/catalogue')}>
          🛠️ Louer du matériel
        </button>
        <button className="kiosk-tile" onClick={() => router.push('/borne/catalogue?available=1')}>
          📅 Voir les machines disponibles
        </button>
        <button className="kiosk-tile" onClick={() => router.push('/borne/reservation')}>
          🎫 J&apos;ai déjà une réservation
        </button>
        <button className="kiosk-tile" onClick={() => router.push('/borne/reservation?scan=1')}>
          📷 Scanner mon QR code
        </button>
        <button
          className="kiosk-tile"
          style={{ gridColumn: '1 / -1' }}
          onClick={() => router.push('/borne/conseiller')}
        >
          🔔 Appeler un conseiller
        </button>
      </div>
      <p style={{ marginTop: 24, opacity: 0.6, fontSize: '0.9rem' }}>
        Borne de démonstration — retour automatique à l&apos;accueil après inactivité, aucune
        donnée personnelle conservée.
      </p>
    </div>
  );
}
