'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Link } from '@/i18n/navigation';
import { useCart, useSession } from '@/lib/providers';

export function Header() {
  const { cart } = useCart();
  const { user } = useSession();
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Ferme le menu mobile à chaque navigation.
  useEffect(() => setOpen(false), [pathname]);
  // Empêche le scroll de la page derrière le tiroir ouvert.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const links = (
    <>
      <Link href="/catalogue">{t('catalogue')}</Link>
      <Link href="/fonctionnement">{t('howItWorks')}</Link>
      <Link href="/click-collect">{t('clickCollect')}</Link>
      <Link href="/livraison">{t('delivery')}</Link>
      <Link href="/pro">{t('pros')}</Link>
      <Link href="/faq">{t('faq')}</Link>
      <Link href={user ? '/compte' : '/connexion'}>
        {user ? `${user.firstName}` : t('login')}
      </Link>
    </>
  );

  return (
    <>
      <div className="demo-ribbon">{tc('demoRibbon')}</div>
      <header className="site-header">
        <div className="container">
          <Logo />
          <nav className="site-nav site-nav--desktop">
            {links}
            <Link href="/panier" className="cart-pill">
              🛒 {t('cart')}
              {cart && cart.itemCount > 0 ? ` (${cart.itemCount})` : ''}
            </Link>
            <LanguageSwitcher />
          </nav>

          <div className="site-nav--mobile">
            <Link href="/panier" className="cart-pill cart-pill--sm">
              🛒{cart && cart.itemCount > 0 ? ` ${cart.itemCount}` : ''}
            </Link>
            <button
              type="button"
              className="burger"
              aria-label={open ? tc('close') : 'Menu'}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <div
        className={`mobile-drawer__backdrop${open ? ' is-open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div className={`mobile-drawer${open ? ' is-open' : ''}`}>
        <nav className="mobile-drawer__nav" onClick={(e) => {
          if ((e.target as HTMLElement).tagName === 'A') setOpen(false);
        }}>
          {links}
        </nav>
        <div className="mobile-drawer__lang">
          <LanguageSwitcher />
        </div>
      </div>
    </>
  );
}
