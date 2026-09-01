import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Footer() {
  const t = useTranslations('nav');
  const tf = useTranslations('footer');
  const tc = useTranslations('common');
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="cols">
          <div>
            <h4>BRICOLOC</h4>
            <p className="small">{tc('tagline')}</p>
            <LanguageSwitcher variant="footer" />
          </div>
          <div>
            <h4>{tf('rent')}</h4>
            <Link href="/catalogue">{t('catalogue')}</Link>
            <br />
            <Link href="/fonctionnement">{t('howItWorks')}</Link>
            <br />
            <Link href="/pro">{tf('servicesPros')}</Link>
          </div>
          <div>
            <h4>{tf('pickupDelivery')}</h4>
            <Link href="/click-collect">{t('clickCollect')}</Link>
            <br />
            <Link href="/livraison">{tf('deliverySite')}</Link>
          </div>
          <div>
            <h4>{tf('help')}</h4>
            <Link href="/faq">{t('faq')}</Link>
            <br />
            <Link href="/conseils">{t('advice')}</Link>
            <br />
            <Link href="/contact">{t('contact')}</Link>
          </div>
          <div>
            <h4>{tf('info')}</h4>
            <Link href="/legal">{t('legal')}</Link>
            <br />
            <Link href="/borne">{t('kiosk')}</Link>
            <br />
            <Link href="/admin">{t('staffArea')}</Link>
          </div>
        </div>
        <p className="small" style={{ marginTop: 24, opacity: 0.7 }}>
          {tf('rights', { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
