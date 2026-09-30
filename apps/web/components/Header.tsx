'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { useDrawerFocus } from './useDrawerFocus';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Link } from '@/i18n/navigation';
import { useCart, useSession } from '@/lib/providers';
import { User, ShoppingCart, Clock } from './icons';

export function Header() {
  const { cart } = useCart();
  const { user } = useSession();
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const tt = useTranslations('topbar');
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  const close = useCallback(() => setOpen(false), []);
  const drawerRef = useDrawerFocus(open, close);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 981px)');
    const onResize = () => { if (desktop.matches) close(); };
    desktop.addEventListener('change', onResize);
    return () => desktop.removeEventListener('change', onResize);
  }, [close]);

  const links = (
    <>
      <Link href="/catalogue" aria-current={pathname === "/catalogue" ? "page" : undefined}>{t('rentTool')}</Link>
      <Link href="/bricopacks" aria-current={pathname.startsWith("/bricopacks") ? "page" : undefined}>{t('bricopacks')}</Link>
      <Link href="/conseils">{t('adviceDiy')}</Link>
      <Link href="/faq">{t('faq')}</Link>
      <Link href="/contact">{t('contact')}</Link>
    </>
  );

  const cartCount = cart && cart.itemCount > 0 ? cart.itemCount : 0;

  return (
    <>
      <div className="top">
        <span><Clock aria-hidden /> {tt('cc')}</span>
        <span aria-hidden>·</span>
        <span>{tt('delivery')}</span>
        <b>{tt('hours')}</b>
      </div>

      <nav className="cnav">
        <Link href="/" className="cnav__logo" aria-label="BRICOLOC">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/logo-bricoloc.webp" alt="BRICOLOC" />
        </Link>

        <div className="cnav__links">{links}</div>

        <div className="cnav__actions">
          <Link href="/pro" className="cnav__pro">
            {t('proSpace')}
          </Link>
          <LanguageSwitcher />
          <Link
            href={user ? '/compte' : '/connexion'}
            className="cnav__account"
            aria-label={user ? user.firstName : t('login')}
            title={user ? user.firstName : t('login')}
          >
            <User />
          </Link>
          <Link href="/panier" className="cnav__bag" aria-label={t('cart')} title={t('cart')}>
            <ShoppingCart />
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
      <div ref={drawerRef} className={`mobile-drawer${open ? ' is-open' : ''}`} role="dialog" aria-modal={open || undefined} aria-label="Menu" inert={!open}>
        <button className="drawer-close" onClick={close}>{tc('close')} ×</button>
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
