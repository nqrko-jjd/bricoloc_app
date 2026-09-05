'use client';
import { useState } from 'react';
import { formatEUR } from '@bricoloc/shared';
import { ArrowRight, Search as ISearch, Heart, CheckCircle } from './icons';

/**
 * Mockup de téléphone interactif (aperçu de l'appli, pas de vraies captures).
 * Remplace les anciennes « fausses fenêtres » CSS avec chips emoji : ici on
 * montre 3 écrans réalistes qu'on peut parcourir, comme une vraie démo.
 */
type Screen = 'home' | 'product' | 'booking' | 'account';
const ORDER: Screen[] = ['home', 'product', 'booking'];
const ORDER_WITH_ACCOUNT: Screen[] = ['home', 'product', 'booking', 'account'];

export function PhoneDemo({ extraScreen = false }: { extraScreen?: boolean }) {
  const [screen, setScreen] = useState<Screen>('home');
  const order = extraScreen ? ORDER_WITH_ACCOUNT : ORDER;
  const idx = order.indexOf(screen);

  return (
    <div className="phdemo">
      <div className="phdemo__bezel">
        <div className="phdemo__notch" aria-hidden />
        <div className="phdemo__screen">
          {screen === 'home' && <HomeScreen onOpenProduct={() => setScreen('product')} />}
          {screen === 'product' && (
            <ProductScreen onBack={() => setScreen('home')} onBook={() => setScreen('booking')} />
          )}
          {screen === 'booking' && <BookingScreen />}
          {screen === 'account' && <AccountScreen />}
        </div>
      </div>
      <div className="phdemo__dots">
        {order.map((s) => (
          <button
            key={s}
            type="button"
            className={s === screen ? 'is-active' : undefined}
            aria-label={s}
            onClick={() => setScreen(s)}
          />
        ))}
      </div>
      <p className="phdemo__hint">
        {idx + 1}/{order.length} — touchez pour explorer
      </p>
    </div>
  );
}

function HomeScreen({ onOpenProduct }: { onOpenProduct: () => void }) {
  const cats = [
    ['🔩', 'Forer'],
    ['🪵', 'Bois'],
    ['🎨', 'Peinture'],
    ['🌿', 'Jardin'],
  ] as const;
  return (
    <div className="phscreen">
      <div className="phscreen__top">
        <b>BRICOLOC.</b>
        <Heart />
      </div>
      <div className="phscreen__search">
        <ISearch />
        <span>Rechercher un outil…</span>
      </div>
      <div className="phscreen__cats">
        {cats.map(([icon, label]) => (
          <div key={label} className="phscreen__cat">
            <span>{icon}</span>
            {label}
          </div>
        ))}
      </div>
      <p className="phscreen__label">Populaire près de vous</p>
      <button type="button" className="phscreen__card" onClick={onOpenProduct}>
        <span className="phscreen__card-ico">🛠️</span>
        <span className="phscreen__card-body">
          <b>Ponceuse girafe</b>
          <small>★ 4,9 · 126 avis</small>
        </span>
        <strong>{formatEUR(19.9)}</strong>
      </button>
      <button type="button" className="phscreen__card" onClick={onOpenProduct}>
        <span className="phscreen__card-ico">🧱</span>
        <span className="phscreen__card-body">
          <b>Malaxeur de mortier</b>
          <small>★ 4,8 · 64 avis</small>
        </span>
        <strong>{formatEUR(20)}</strong>
      </button>
    </div>
  );
}

function ProductScreen({ onBack, onBook }: { onBack: () => void; onBook: () => void }) {
  return (
    <div className="phscreen">
      <div className="phscreen__top">
        <button type="button" className="phscreen__icobtn" onClick={onBack} aria-label="Retour">
          ‹
        </button>
        <Heart />
      </div>
      <div className="phscreen__hero" aria-hidden>
        🛠️
      </div>
      <b className="phscreen__title">Ponceuse girafe</b>
      <small className="phscreen__muted">★ 4,9 · 126 avis · Disponible</small>
      <div className="phscreen__tiers">
        <div>
          <span>Jour</span>
          <b>{formatEUR(19.9)}</b>
        </div>
        <div>
          <span>Semaine</span>
          <b>{formatEUR(79.6)}</b>
        </div>
      </div>
      <button type="button" className="phscreen__cta" onClick={onBook}>
        Réserver <ArrowRight />
      </button>
    </div>
  );
}

function BookingScreen() {
  return (
    <div className="phscreen phscreen--center">
      <span className="phscreen__check">
        <CheckCircle />
      </span>
      <b className="phscreen__title">Réservation confirmée</b>
      <small className="phscreen__muted">BRL-2049</small>
      <div className="phscreen__qr" aria-hidden />
      <small className="phscreen__muted">Présentez ce code au comptoir</small>
    </div>
  );
}

function AccountScreen() {
  const rows = [
    ['Ponceuse girafe', 'En cours · retour ven. 18h'],
    ['Malaxeur de mortier', 'Terminée le 2 sept.'],
  ] as const;
  return (
    <div className="phscreen">
      <div className="phscreen__top">
        <b>Mes réservations</b>
      </div>
      {rows.map(([name, status]) => (
        <div key={name} className="phscreen__resa">
          <b>{name}</b>
          <small>{status}</small>
        </div>
      ))}
    </div>
  );
}
