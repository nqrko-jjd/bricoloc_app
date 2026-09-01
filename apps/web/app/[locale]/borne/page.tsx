'use client';
import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { SUPPORTED_LOCALES, type Locale } from '@bricoloc/shared';
import { resetKioskSession } from '@/lib/kiosk';

const T: Record<Locale, Record<string, string>> = {
  fr: {
    tagline: 'Le bon outil. Au bon moment.',
    rent: 'Louer du matériel',
    available: 'Voir les machines disponibles',
    hasReservation: 'J’ai déjà une réservation',
    scan: 'Scanner mon QR code',
    how: 'Comment ça marche',
    faq: 'Questions fréquentes',
    advisor: 'Appeler un conseiller',
    footer: 'Retour automatique à l’accueil après inactivité — aucune donnée personnelle conservée.',
    hours: 'Comptoir ouvert du lundi au vendredi 7h–18h · samedi 8h–13h',
  },
  nl: {
    tagline: 'Het juiste gereedschap. Op het juiste moment.',
    rent: 'Materiaal huren',
    available: 'Beschikbare machines bekijken',
    hasReservation: 'Ik heb al een reservering',
    scan: 'Mijn QR-code scannen',
    how: 'Zo werkt het',
    faq: 'Veelgestelde vragen',
    advisor: 'Een medewerker roepen',
    footer: 'Automatische terugkeer naar het startscherm na inactiviteit — geen persoonlijke gegevens bewaard.',
    hours: 'Balie open van maandag tot vrijdag 7–18u · zaterdag 8–13u',
  },
  en: {
    tagline: 'The right tool. At the right time.',
    rent: 'Rent equipment',
    available: 'See available machines',
    hasReservation: 'I already have a booking',
    scan: 'Scan my QR code',
    how: 'How it works',
    faq: 'Frequently asked questions',
    advisor: 'Call an advisor',
    footer: 'Automatic return to the home screen after inactivity — no personal data kept.',
    hours: 'Counter open Monday to Friday 7am–6pm · Saturday 8am–1pm',
  },
};

export default function BorneHome() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const locale = useLocale() as Locale;
  const t = T[locale] ?? T.fr;

  useEffect(() => {
    resetKioskSession();
  }, []);

  const go = (href: string) => router.push(href);

  return (
    <div className="kiosk-body kiosk-home">
      <div className="kiosk-langs">
        {SUPPORTED_LOCALES.map((l) => (
          <button
            key={l}
            className={l === locale ? 'is-active' : ''}
            onClick={() =>
              // @ts-expect-error params dynamiques transmis tels quels
              router.replace({ pathname, params }, { locale: l })
            }
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="logo on-dark kiosk-logo">
        <span className="b">BRICO</span>
        <span className="l">LOC</span>
      </div>
      <p className="kiosk-tagline">{t.tagline}</p>

      <div className="kiosk-grid">
        <button className="kiosk-tile brico" onClick={() => go('/borne/catalogue')}>
          🛠️ {t.rent}
        </button>
        <button className="kiosk-tile" onClick={() => go('/borne/catalogue?available=1')}>
          📅 {t.available}
        </button>
        <button className="kiosk-tile" onClick={() => go('/borne/reservation')}>
          🎫 {t.hasReservation}
        </button>
        <button className="kiosk-tile" onClick={() => go('/borne/reservation?scan=1')}>
          📷 {t.scan}
        </button>
        <button className="kiosk-tile kiosk-tile--soft" onClick={() => go('/borne/infos')}>
          💡 {t.how}
        </button>
        <button className="kiosk-tile kiosk-tile--soft" onClick={() => go('/borne/infos#faq')}>
          ❓ {t.faq}
        </button>
        <button
          className="kiosk-tile kiosk-tile--wide"
          onClick={() => go('/borne/conseiller')}
        >
          🔔 {t.advisor}
        </button>
      </div>

      <div className="kiosk-strip">{t.hours}</div>
      <p className="kiosk-foot">{t.footer}</p>
    </div>
  );
}
