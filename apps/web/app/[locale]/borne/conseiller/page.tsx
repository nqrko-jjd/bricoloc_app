'use client';
import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';

export default function BorneConseiller() {
  const router = useRouter();
  const [count, setCount] = useState(20);
  useEffect(() => {
    const t = setInterval(() => setCount((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (count <= 0) router.push('/borne');
  }, [count, router]);

  return (
    <div className="kiosk-body">
      <div style={{ fontSize: '4rem' }}>🔔</div>
      <h1>Un conseiller arrive</h1>
      <p style={{ fontSize: '1.3rem', opacity: 0.9 }}>
        Nous avons prévenu l&apos;équipe BRICOLOC. Merci de patienter quelques instants au
        comptoir.
      </p>
      <p style={{ opacity: 0.6 }}>Retour à l&apos;accueil dans {count}s</p>
      <button className="btn btn-ghost" onClick={() => router.push('/borne')}>
        Retour à l&apos;accueil
      </button>
    </div>
  );
}
