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
  const tt = useTranslations('topbar');
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const mainLinks = (
    <>
      <Link href="/catalogue">{t('rentTool')}</Link>
      <Link href="/catalogue?kind=PACK">{t('bricopacks')}</Link>
      <Link href="/conseils">{t('adviceDiy')}</Link>
      <Link href="/application">{t('app')}</Link>
      <Link href="/borne">{t('kiosk')}</Link>
    </>
  );

  const cartCount = cart && cart.itemCount > 0 ? cart.itemCount : 0;

  return (
    <>
      <div className="topbar">
        <div className="container topbar__row">
          <span className="topbar__info">
            <span>◷ {tt('cc')}</span>
            <span className="topbar__dot">•</span>
            <span>{tt('delivery')}</span>
          </span>
          <span className="topbar__hours">{tt('hours')}</span>
        </div>
      </div>
      <div className="demo-ribbon">{tc('demoRibbon')}</div>

      <header className="site-header">
        <div className="container site-header__row">
          <Logo />
          <nav className="site-nav site-nav--desktop">{mainLinks}</nav>
          <div className="site-header__actions">
            <Link href="/pro" className="nav-pro">
              {t('proSpace')}
            </Link>
            <LanguageSwitcher />
            <Link href={user ? '/compte' : '/connexion'} className="nav-account">
              {user ? user.firstName : t('login')}
            </Link>
            <Link href="/panier" className="cart-pill">
              <span aria-hidden>🛒</span> {t('cart')}
              {cartCount ? <span className="cart-pill__count">{cartCount}</span> : null}
            </Link>
          </div>

          <div className="site-nav--mobile">
            <Link href="/panier" className="cart-pill cart-pill--sm">
              <span aria-hidden>🛒</span>
              {cartCount ? <span className="cart-pill__count">{cartCount}</span> : null}
            </Link>
            <button
              type="button"
              className={`burger${open ? ' is-open' : ''}`}
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
        <nav
          className="mobile-drawer__nav"
          onClick={(e) => {
            if ((e.target as HTMLElement).tagName === 'A') setOpen(false);
          }}
        >
          {mainLinks}
          <Link href="/pro">{t('proSpace')}</Link>
          <Link href={user ? '/compte' : '/connexion'}>
            {user ? user.firstName : t('login')}
          </Link>
        </nav>
        <div className="mobile-drawer__lang">
          <LanguageSwitcher />
        </div>
      </div>
    </>
  );
}
