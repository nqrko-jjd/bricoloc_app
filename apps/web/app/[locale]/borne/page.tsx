'use client';
import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { SUPPORTED_LOCALES, type Locale } from '@bricoloc/shared';
import { resetKioskSession } from '@/lib/kiosk';
import { KioskFrame } from '@/components/kiosk/KioskFrame';

const T: Record<Locale, Record<string, string>> = {
  fr: {
    welcome: 'Bienvenue chez Bricoloc',
    q: 'Comment peut-on vous',
    qAccent: 'aider ?',
    sub: 'Choisissez un accès pour commencer.',
    project: 'Je décris mon projet',
    projectSub: 'On vous montre les bons outils',
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
    footer: 'Retour automatique à l’accueil après inactivité — aucune donnée personnelle conservée.',
  },
  nl: {
    welcome: 'Welkom bij Bricoloc',
    q: 'Hoe kunnen we u',
    qAccent: 'helpen?',
    sub: 'Kies een ingang om te beginnen.',
    project: 'Ik beschrijf mijn project',
    projectSub: 'Wij tonen u het juiste gereedschap',
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
    footer: 'Automatische terugkeer naar het startscherm na inactiviteit — geen persoonlijke gegevens bewaard.',
  },
  en: {
    welcome: 'Welcome to Bricoloc',
    q: 'How can we',
    qAccent: 'help you?',
    sub: 'Choose an entry point to start.',
    project: 'Describe my project',
    projectSub: 'We’ll show you the right tools',
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
    footer: 'Automatic return to the home screen after inactivity — no personal data kept.',
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
  const switchLocale = (l: Locale) =>
    // @ts-expect-error params dynamiques transmis tels quels
    router.replace({ pathname, params }, { locale: l });

  return (
    <KioskFrame step={1} locale={locale} locales={SUPPORTED_LOCALES} onLocale={switchLocale}>
      <div className="kiosk-ask">
        <span className="kicker">— {t.welcome}</span>
        <h1>
          {t.q} <i>{t.qAccent}</i>
        </h1>
        <button className="kiosk-projet" onClick={() => go('/borne/projet')}>
          <span>
            <strong>{t.project}</strong>
            <small>{t.projectSub}</small>
          </span>
          <span aria-hidden>→</span>
        </button>
        <p>{t.sub}</p>
      </div>

      <div className="kiosk-tiles">
        <button className="kiosk-tile kiosk-tile--pack" onClick={() => go('/borne/catalogue?kind=PACK')}>
          <span className="kiosk-tile__ic" aria-hidden>
            🧰
          </span>
          <span>
            <span className="kiosk-tile__t">{t.pack}</span>
            <span className="kiosk-tile__s">{t.packSub}</span>
          </span>
        </button>
        <button className="kiosk-tile" onClick={() => go('/borne/catalogue')}>
          <span className="kiosk-tile__ic" aria-hidden>
            ⚙️
          </span>
          <span className="kiosk-tile__t">{t.catalogue}</span>
          <span className="kiosk-tile__s">{t.catalogueSub}</span>
        </button>
        <button className="kiosk-tile kiosk-tile--navy" onClick={() => go('/borne/reservation?scan=1')}>
          <span className="kiosk-tile__ic" aria-hidden>
            ▣
          </span>
          <span className="kiosk-tile__t">{t.reservation}</span>
          <span className="kiosk-tile__s">{t.reservationSub}</span>
        </button>
        <button className="kiosk-tile" onClick={() => go('/borne/infos')}>
          <span className="kiosk-tile__ic" aria-hidden>
            ⓘ
          </span>
          <span className="kiosk-tile__t">{t.infos}</span>
          <span className="kiosk-tile__s">{t.infosSub}</span>
        </button>
        <button className="kiosk-tile" onClick={() => go('/borne/conseiller')}>
          <span className="kiosk-tile__ic" aria-hidden>
            ?
          </span>
          <span className="kiosk-tile__t">{t.help}</span>
          <span className="kiosk-tile__s">{t.helpSub}</span>
        </button>
      </div>
    </KioskFrame>
  );
}
