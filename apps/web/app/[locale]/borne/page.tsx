'use client';
import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { SUPPORTED_LOCALES, type Locale } from '@bricoloc/shared';
import { resetKioskSession } from '@/lib/kiosk';

const T: Record<Locale, Record<string, string>> = {
  fr: {
    welcome: 'Bienvenue chez Bricoloc',
    q: 'Comment peut-on vous',
    qAccent: 'aider ?',
    sub: 'Choisissez un accès pour commencer.',
    pack: 'Choisir un BricoPack',
    packSub: 'Une solution complète pour votre projet',
    catalogue: 'Catalogue',
    catalogueSub: 'Tous les outils à louer',
    reservation: 'Ma réservation',
    reservationSub: 'Scanner ou saisir mon code',
    infos: 'Infos pratiques',
    infosSub: 'Horaires, caution et retour',
    help: 'Besoin d’aide',
    helpSub: 'Appeler un conseiller',
    hours: 'Comptoir ouvert du lundi au vendredi 7h–18h · samedi 8h–13h',
    footer: 'Retour automatique à l’accueil après inactivité — aucune donnée personnelle conservée.',
  },
  nl: {
    welcome: 'Welkom bij Bricoloc',
    q: 'Hoe kunnen we u',
    qAccent: 'helpen?',
    sub: 'Kies een ingang om te beginnen.',
    pack: 'Een BricoPack kiezen',
    packSub: 'Een complete oplossing voor uw project',
    catalogue: 'Catalogus',
    catalogueSub: 'Al het te huren gereedschap',
    reservation: 'Mijn reservering',
    reservationSub: 'Scan of voer mijn code in',
    infos: 'Praktische info',
    infosSub: 'Uren, borg en teruggave',
    help: 'Hulp nodig',
    helpSub: 'Een medewerker roepen',
    hours: 'Balie open van maandag tot vrijdag 7–18u · zaterdag 8–13u',
    footer: 'Automatische terugkeer naar het startscherm na inactiviteit — geen persoonlijke gegevens bewaard.',
  },
  en: {
    welcome: 'Welcome to Bricoloc',
    q: 'How can we',
    qAccent: 'help you?',
    sub: 'Choose an entry point to start.',
    pack: 'Choose a BricoPack',
    packSub: 'A complete solution for your project',
    catalogue: 'Catalogue',
    catalogueSub: 'All the tools for rent',
    reservation: 'My booking',
    reservationSub: 'Scan or enter my code',
    infos: 'Practical info',
    infosSub: 'Hours, deposit and return',
    help: 'Need help',
    helpSub: 'Call an advisor',
    hours: 'Counter open Monday to Friday 7am–6pm · Saturday 8am–1pm',
    footer: 'Automatic return to the home screen after inactivity — no personal data kept.',
  },
};

const STEPS = ['Accueil', 'Projet', 'Catalogue', 'Fiche outil', 'Dates', 'Panier', 'Paiement'];

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
    <div className="kiosk">
      {/* Barre d'étapes */}
      <div className="kiosk-stepbar" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} className={`kiosk-stepbar__s${i === 0 ? ' is-active' : ''}`}>
            <b>{i + 1}</b> {s}
          </span>
        ))}
      </div>

      <div className="kiosk-topbar">
        <span className="logo on-dark kiosk-logo">
          <span className="b">BRICO</span>
          <span className="l">LOC</span>
        </span>
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
      </div>

      <div className="kiosk-hero">
        <span className="kicker">— {t.welcome}</span>
        <h1>
          {t.q} <i>{t.qAccent}</i>
        </h1>
        <p>{t.sub}</p>
      </div>

      <div className="kiosk-grid">
        <button className="kiosk-tile kiosk-tile--pack" onClick={() => go('/borne/catalogue?kind=PACK')}>
          <span className="kiosk-tile__ic" aria-hidden>
            🧰
          </span>
          <span className="kiosk-tile__t">{t.pack}</span>
          <span className="kiosk-tile__s">{t.packSub}</span>
        </button>
        <button className="kiosk-tile" onClick={() => go('/borne/catalogue')}>
          <span className="kiosk-tile__ic" aria-hidden>
            ⚙️
          </span>
          <span className="kiosk-tile__t">{t.catalogue}</span>
          <span className="kiosk-tile__s">{t.catalogueSub}</span>
        </button>
        <button className="kiosk-tile" onClick={() => go('/borne/reservation?scan=1')}>
          <span className="kiosk-tile__ic" aria-hidden>
            ▣
          </span>
          <span className="kiosk-tile__t">{t.reservation}</span>
          <span className="kiosk-tile__s">{t.reservationSub}</span>
        </button>
        <button className="kiosk-tile kiosk-tile--soft" onClick={() => go('/borne/infos')}>
          <span className="kiosk-tile__ic" aria-hidden>
            ⓘ
          </span>
          <span className="kiosk-tile__t">{t.infos}</span>
          <span className="kiosk-tile__s">{t.infosSub}</span>
        </button>
        <button className="kiosk-tile kiosk-tile--soft" onClick={() => go('/borne/conseiller')}>
          <span className="kiosk-tile__ic" aria-hidden>
            ?
          </span>
          <span className="kiosk-tile__t">{t.help}</span>
          <span className="kiosk-tile__s">{t.helpSub}</span>
        </button>
      </div>

      <div className="kiosk-strip">{t.hours}</div>
      <p className="kiosk-foot">{t.footer}</p>
    </div>
  );
}
