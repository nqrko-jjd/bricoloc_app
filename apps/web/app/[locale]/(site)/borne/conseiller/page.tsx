'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { type Locale } from '@bricoloc/shared';

const T: Record<Locale, { title: string; body: string; back: string; countdown: string }> = {
  fr: {
    title: 'Un conseiller arrive',
    body: "Nous avons prévenu l'équipe BRICOLOC. Merci de patienter quelques instants au comptoir.",
    back: "Retour à l'accueil",
    countdown: "Retour à l'accueil dans",
  },
  nl: {
    title: 'Een medewerker komt eraan',
    body: 'We hebben het BRICOLOC-team verwittigd. Even geduld aan de balie.',
    back: 'Terug naar start',
    countdown: 'Terug naar start over',
  },
  en: {
    title: 'An advisor is on the way',
    body: "We've notified the BRICOLOC team. Please wait a moment at the counter.",
    back: 'Back to home',
    countdown: 'Back to home in',
  },
};

export default function BorneConseiller() {
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = T[locale] ?? T.fr;
  const [count, setCount] = useState(20);

  useEffect(() => {
    const iv = setInterval(() => setCount((c) => c - 1), 1000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    if (count <= 0) router.push('/borne');
  }, [count, router]);

  return (
    <div className="kioskm-page kiosk-center">
      <div style={{ fontSize: '4rem' }}>🔔</div>
      <h1>{t.title}</h1>
      <p className="kioskm-sub" style={{ fontSize: '1.15rem' }}>
        {t.body}
      </p>
      <p className="kioskm-sub" style={{ opacity: 0.6 }}>
        {t.countdown} {count}s
      </p>
      <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => router.push('/borne')}>
        {t.back}
      </button>
    </div>
  );
}
