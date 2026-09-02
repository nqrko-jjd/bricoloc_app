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
    q: 'Que souhaitez-vous',
    qAccent: 'réaliser ?',
    search: 'Rechercher un outil ou un projet',
    catalogue: 'Catalogue',
    catalogueSub: 'Tous les outils',
    pack: 'BricoPacks',
    packSub: 'Un projet complet',
    reservation: 'Ma réservation',
    reservationSub: 'Scanner mon code',
    infos: 'Infos pratiques',
    infosSub: 'Retrait, retour, caution',
    help: 'Besoin d’aide ?',
    helpSub: 'Un conseiller peut vous accompagner',
  },
  nl: {
    welcome: 'Welkom bij Bricoloc',
    q: 'Wat wilt u',
    qAccent: 'realiseren?',
    search: 'Zoek een tool of een project',
    catalogue: 'Catalogus',
    catalogueSub: 'Al het gereedschap',
    pack: 'BricoPacks',
    packSub: 'Een compleet project',
    reservation: 'Mijn reservering',
    reservationSub: 'Mijn code scannen',
    infos: 'Praktische info',
    infosSub: 'Ophalen, teruggave, borg',
    help: 'Hulp nodig?',
    helpSub: 'Een medewerker helpt u graag',
  },
  en: {
    welcome: 'Welcome to Bricoloc',
    q: 'What do you want',
    qAccent: 'to build?',
    search: 'Search a tool or a project',
    catalogue: 'Catalogue',
    catalogueSub: 'All the tools',
    pack: 'BricoPacks',
    packSub: 'A complete project',
    reservation: 'My booking',
    reservationSub: 'Scan my code',
    infos: 'Practical info',
    infosSub: 'Pickup, return, deposit',
    help: 'Need help?',
    helpSub: 'An advisor can assist you',
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
    <KioskFrame locale={locale} locales={SUPPORTED_LOCALES} onLocale={switchLocale}>
      <div className="kiosk-pad">
        <span className="kicker">— {t.welcome}</span>
        <h1>
          {t.q}
          <br />
          <i>{t.qAccent}</i>
        </h1>

        <button className="kiosk-search" onClick={() => go('/borne/projet')}>
          <span aria-hidden>🔍</span>
          {t.search}
        </button>

        <div className="kiosk-grid2">
          <button className="kiosk-tile" onClick={() => go('/borne/catalogue')}>
            <span className="kiosk-tile__ic" aria-hidden>
              🔧
            </span>
            <span>
              <span className="kiosk-tile__t">{t.catalogue}</span>
              <span className="kiosk-tile__s">{t.catalogueSub}</span>
            </span>
          </button>
          <button className="kiosk-tile kiosk-tile--red" onClick={() => go('/borne/catalogue?kind=PACK')}>
            <span className="kiosk-tile__ic" aria-hidden>
              🧰
            </span>
            <span>
              <span className="kiosk-tile__t">{t.pack}</span>
              <span className="kiosk-tile__s">{t.packSub}</span>
            </span>
          </button>
          <button className="kiosk-tile" onClick={() => go('/borne/reservation?scan=1')}>
            <span className="kiosk-tile__ic" aria-hidden>
              ▣
            </span>
            <span>
              <span className="kiosk-tile__t">{t.reservation}</span>
              <span className="kiosk-tile__s">{t.reservationSub}</span>
            </span>
          </button>
          <button className="kiosk-tile" onClick={() => go('/borne/infos')}>
            <span className="kiosk-tile__ic" aria-hidden>
              ⓘ
            </span>
            <span>
              <span className="kiosk-tile__t">{t.infos}</span>
              <span className="kiosk-tile__s">{t.infosSub}</span>
            </span>
          </button>
        </div>

        <button className="kiosk-aide" onClick={() => go('/borne/conseiller')}>
          <span>
            <strong>{t.help}</strong>
            <small>{t.helpSub}</small>
          </span>
          <span aria-hidden>?</span>
        </button>
      </div>
    </KioskFrame>
  );
}
