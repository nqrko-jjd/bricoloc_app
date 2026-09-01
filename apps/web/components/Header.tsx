'use client';
import { useTranslations } from 'next-intl';
import { Logo } from './Logo';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Link } from '@/i18n/navigation';
import { useCart, useSession } from '@/lib/providers';

export function Header() {
  const { cart } = useCart();
  const { user } = useSession();
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  return (
    <>
      <div className="demo-ribbon">{tc('demoRibbon')}</div>
      <header className="site-header">
        <div className="container">
          <Logo />
          <nav className="site-nav">
            <Link href="/catalogue">{t('catalogue')}</Link>
            <Link href="/fonctionnement">{t('howItWorks')}</Link>
            <Link href="/click-collect">{t('clickCollect')}</Link>
            <Link href="/livraison">{t('delivery')}</Link>
            <Link href="/pro">{t('pros')}</Link>
            <Link href="/faq">{t('faq')}</Link>
            <Link href={user ? '/compte' : '/connexion'}>
              {user ? `${user.firstName}` : t('login')}
            </Link>
            <Link href="/panier" className="cart-pill">
              🛒 {t('cart')}
              {cart && cart.itemCount > 0 ? ` (${cart.itemCount})` : ''}
            </Link>
            <LanguageSwitcher />
          </nav>
        </div>
      </header>
    </>
  );
}
