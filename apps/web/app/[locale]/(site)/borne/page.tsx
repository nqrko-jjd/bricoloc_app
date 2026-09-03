'use client';
import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import type { Locale } from '@bricoloc/shared';
import { enterKiosk } from '@/lib/kiosk';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import {
  Search as ISearch,
  PackageIcon,
  Sparkles,
  ArrowUpRight,
} from '@/components/icons';

const T: Record<Locale, Record<string, string>> = {
  fr: {
    welcome: 'Bienvenue chez Bricoloc',
    q: 'Que souhaitez-vous',
    qa: 'réaliser ?',
    search: 'Un outil ou un projet…',
    catalogue: 'Catalogue',
    catalogueSub: 'Tous les outils',
    pack: 'BricoPacks',
    packSub: 'Un projet, un pack',
    projet: 'Par projet',
    projetSub: 'On choisit pour vous',
    resa: 'Ma réservation',
    resaSub: 'Scanner ou saisir mon code',
    infos: 'Infos pratiques',
    infosSub: 'Retrait, retour, caution',
    help: 'Besoin d’aide ?',
    helpSub: 'Un conseiller vous accompagne',
  },
  nl: {
    welcome: 'Welkom bij Bricoloc',
    q: 'Wat wilt u',
    qa: 'realiseren?',
    search: 'Een tool of een project…',
    catalogue: 'Catalogus',
    catalogueSub: 'Al het gereedschap',
    pack: 'BricoPacks',
    packSub: 'Eén project, één pack',
    projet: 'Per project',
    projetSub: 'Wij kiezen voor u',
    resa: 'Mijn reservering',
    resaSub: 'Scan of typ mijn code',
    infos: 'Praktische info',
    infosSub: 'Ophalen, teruggave, borg',
    help: 'Hulp nodig?',
    helpSub: 'Een medewerker helpt u',
  },
  en: {
    welcome: 'Welcome to Bricoloc',
    q: 'What do you want',
    qa: 'to build?',
    search: 'A tool or a project…',
    catalogue: 'Catalogue',
    catalogueSub: 'All the tools',
    pack: 'BricoPacks',
    packSub: 'One project, one pack',
    projet: 'By project',
    projetSub: 'We pick for you',
    resa: 'My booking',
    resaSub: 'Scan or type my code',
    infos: 'Practical info',
    infosSub: 'Pickup, return, deposit',
    help: 'Need help?',
    helpSub: 'An advisor will assist you',
  },
};

export default function BorneHome() {
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = T[locale] ?? T.fr;

  useEffect(() => {
    enterKiosk();
  }, []);

  const tiles = [
    { href: '/catalogue', ic: <ISearch />, t: t.catalogue, s: t.catalogueSub, red: false },
    { href: '/bricopacks', ic: <PackageIcon />, t: t.pack, s: t.packSub, red: true },
    { href: '/borne/projet', ic: <Sparkles />, t: t.projet, s: t.projetSub, red: false },
    { href: '/borne/reservation', ic: <span aria-hidden>▣</span>, t: t.resa, s: t.resaSub, red: false },
    { href: '/borne/infos', ic: <span aria-hidden>ⓘ</span>, t: t.infos, s: t.infosSub, red: false },
    { href: '/borne/conseiller', ic: <span aria-hidden>?</span>, t: t.help, s: t.helpSub, red: false },
  ];

  return (
    <div className="kioskm-home">
      <span className="kicker">— {t.welcome}</span>
      <h1>
        {t.q} <i>{t.qa}</i>
      </h1>

      <div className="kioskm-home__search">
        <SearchAutocomplete variant="hero" placeholder={t.search} />
      </div>

      <div className="kioskm-home__grid">
        {tiles.map((x) => (
          <Link
            key={x.href}
            href={x.href}
            className={`kioskm-tile${x.red ? ' kioskm-tile--red' : ''}`}
            onClick={() => x.href === '/borne/projet' && router.prefetch?.('/catalogue')}
          >
            <span className="kioskm-tile__ic">{x.ic}</span>
            <span className="kioskm-tile__t">{x.t}</span>
            <span className="kioskm-tile__s">{x.s}</span>
            <ArrowUpRight />
          </Link>
        ))}
      </div>
    </div>
  );
}
