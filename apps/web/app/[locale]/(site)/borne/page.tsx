'use client';
import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@bricoloc/shared';
import { enterKiosk } from '@/lib/kiosk';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import { Search as ISearch, PackageIcon, Sparkles, ArrowRight } from '@/components/icons';

const T: Record<Locale, Record<string, string>> = {
  fr: {
    q: 'Que souhaitez-vous',
    qa: 'réaliser ?',
    search: 'Rechercher un outil ou un projet',
    catalogue: 'Catalogue',
    catalogueSub: 'Tous les outils à louer',
    pack: 'BricoPacks',
    packSub: 'Une solution complète pour votre projet',
    projet: 'Par projet',
    projetSub: 'On choisit les bons outils',
    resa: 'Ma réservation',
    resaSub: 'Scanner ou saisir mon code',
    infos: 'Infos pratiques',
    infosSub: 'Horaires, caution et retour',
    help: 'Besoin d’aide ?',
  },
  nl: {
    q: 'Wat wilt u',
    qa: 'realiseren?',
    search: 'Zoek een tool of een project',
    catalogue: 'Catalogus',
    catalogueSub: 'Al het gereedschap te huur',
    pack: 'BricoPacks',
    packSub: 'Een complete oplossing voor uw project',
    projet: 'Per project',
    projetSub: 'Wij kiezen het juiste gereedschap',
    resa: 'Mijn reservering',
    resaSub: 'Scan of typ mijn code',
    infos: 'Praktische info',
    infosSub: 'Uren, borg en teruggave',
    help: 'Hulp nodig?',
  },
  en: {
    q: 'What do you want',
    qa: 'to build?',
    search: 'Search a tool or a project',
    catalogue: 'Catalogue',
    catalogueSub: 'All the tools for rent',
    pack: 'BricoPacks',
    packSub: 'A complete solution for your project',
    projet: 'By project',
    projetSub: 'We pick the right tools',
    resa: 'My booking',
    resaSub: 'Scan or type my code',
    infos: 'Practical info',
    infosSub: 'Hours, deposit and return',
    help: 'Need help?',
  },
};

export default function BorneHome() {
  const locale = useLocale() as Locale;
  const t = T[locale] ?? T.fr;

  useEffect(() => {
    enterKiosk();
  }, []);

  return (
    <div className="kioskm-home">
      <h1>
        {t.q}
        <br />
        <i>{t.qa}</i>
      </h1>

      <div className="kioskm-home__search">
        <SearchAutocomplete variant="hero" placeholder={t.search} />
      </div>

      <div className="kioskm-home__grid">
        <Link href="/borne/catalogue" className="kioskm-tile">
          <span className="kioskm-tile__ic">
            <ISearch />
          </span>
          <span className="kioskm-tile__t">{t.catalogue}</span>
          <span className="kioskm-tile__s">{t.catalogueSub}</span>
          <ArrowRight />
        </Link>

        <Link href="/borne/bricopacks" className="kioskm-tile kioskm-tile--red">
          <span className="kioskm-tile__ic">
            <PackageIcon />
          </span>
          <span className="kioskm-tile__t">{t.pack}</span>
          <span className="kioskm-tile__s">{t.packSub}</span>
          <ArrowRight />
        </Link>

        <Link href="/borne/projet" className="kioskm-tile">
          <span className="kioskm-tile__ic">
            <Sparkles />
          </span>
          <span className="kioskm-tile__t">{t.projet}</span>
          <span className="kioskm-tile__s">{t.projetSub}</span>
          <ArrowRight />
        </Link>

        <Link href="/borne/reservation" className="kioskm-tile kioskm-tile--navy">
          <span className="kioskm-tile__ic" aria-hidden>
            ▣
          </span>
          <span className="kioskm-tile__t">{t.resa}</span>
          <span className="kioskm-tile__s">{t.resaSub}</span>
          <ArrowRight />
        </Link>

        <Link href="/borne/infos" className="kioskm-tile">
          <span className="kioskm-tile__ic" aria-hidden>
            ⓘ
          </span>
          <span className="kioskm-tile__t">{t.infos}</span>
          <span className="kioskm-tile__s">{t.infosSub}</span>
          <ArrowRight />
        </Link>
      </div>

      <Link href="/borne/conseiller" className="kioskm-home__help">
        <span aria-hidden>?</span> {t.help}
      </Link>
    </div>
  );
}
