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

  const links = (
    <>
      <Link href="/catalogue">{t('rentTool')}</Link>
      <Link href="/bricopacks">{t('bricopacks')}</Link>
      <Link href="/conseils">{t('adviceDiy')}</Link>
      <Link href="/application">{t('app')}</Link>
    </>
  );

  const cartCount = cart && cart.itemCount > 0 ? cart.itemCount : 0;

  return (
    <>
      <div className="top">
        <span>◷ {tt('cc')}</span>
        <span aria-hidden>·</span>
        <span>{tt('delivery')}</span>
        <b>{tt('hours')}</b>
      </div>
      <div className="demo-ribbon">{tc('demoRibbon')}</div>

      <nav className="cnav">
        <Logo />

        <div className="cnav__links">{links}</div>

        <div className="cnav__actions">
          <Link href="/pro" className="cnav__pro">
            {t('proSpace')}
          </Link>
          <LanguageSwitcher />
          <Link href={user ? '/compte' : '/connexion'} className="cnav__account">
            {user ? user.firstName : t('login')}
          </Link>
          <Link href="/panier" className="cnav__bag">
            {t('cart')}
            {cartCount ? <span>{cartCount}</span> : null}
          </Link>
        </div>

        <button
          type="button"
          className={`cnav__burger${open ? ' is-open' : ''}`}
          aria-label={open ? tc('close') : 'Menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

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
          {links}
          <Link href="/pro">{t('proSpace')}</Link>
          <Link href={user ? '/compte' : '/connexion'}>
            {user ? user.firstName : t('login')}
          </Link>
          <Link href="/panier">
            {t('cart')}
            {cartCount ? ` (${cartCount})` : ''}
          </Link>
        </nav>
        <div className="mobile-drawer__lang">
          <LanguageSwitcher />
        </div>
      </div>
    </>
  );
}
