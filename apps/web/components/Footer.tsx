import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from './LanguageSwitcher';

const ADDRESS = 'Gieterijstraat 49, 1601 Ruisbroek (Sint-Pieters-Leeuw)';
const PHONE = '+32 2 887 77 88';
const EMAIL = 'info@bricoloc.be';

export function Footer() {
  const t = useTranslations('nav');
  const tf = useTranslations('footer');

  return (
    <footer className="site-footer">
      <div className="container">
        <p className="site-footer__slogan">
          Louez mieux, <em>travaillez mieux.</em>
        </p>

        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <p className="small">{tf('blurb')}</p>
            <address className="site-footer__contact small">
              {ADDRESS}
              <br />
              <a href={`tel:${PHONE.replace(/\s/g, '')}`}>{PHONE}</a> ·{' '}
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            </address>
            <LanguageSwitcher variant="footer" />
          </div>

          <nav className="site-footer__col">
            <h4>{tf('rent')}</h4>
            <Link href="/catalogue">{t('rentTool')}</Link>
            <Link href="/catalogue?kind=PACK">{t('bricopacks')}</Link>
            <Link href="/fonctionnement">{t('howItWorks')}</Link>
            <Link href="/pro">{tf('servicesPros')}</Link>
          </nav>

          <nav className="site-footer__col">
            <h4>{tf('pickupDelivery')}</h4>
            <Link href="/click-collect">{t('clickCollect')}</Link>
            <Link href="/livraison">{tf('deliverySite')}</Link>
            <Link href="/application">{tf('app')}</Link>
          </nav>

          <nav className="site-footer__col">
            <h4>{tf('help')}</h4>
            <Link href="/conseils">{t('adviceDiy')}</Link>
            <Link href="/faq">{t('faq')}</Link>
            <Link href="/contact">{t('contact')}</Link>
            <Link href="/legal">{t('legal')}</Link>
          </nav>
        </div>

        <div className="site-footer__bottom small">
          <span>{tf('rights', { year: new Date().getFullYear() })}</span>
          <Link href="/admin">{t('staffArea')}</Link>
        </div>
      </div>
    </footer>
  );
}
