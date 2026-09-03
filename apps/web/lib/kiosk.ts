'use client';
import { useEffect, useState } from 'react';

/**
 * Mode borne : la borne réutilise les pages du site (catalogue, bricopacks,
 * commande) en plein écran, sans en-tête ni pied de page. Un cookie
 * `bricoloc_kiosk` (lisible côté serveur par le layout `(site)`) commande
 * l'affichage de la coque borne.
 */
const COOKIE = 'bricoloc_kiosk';
const TOKEN_KEY = 'bricoloc_token';
const CART_KEY = 'bricoloc_cart_key';

function setCookie(v: string, maxAge: number) {
  document.cookie = `${COOKIE}=${v}; path=/; max-age=${maxAge}; samesite=lax`;
}

/** Entre en mode borne : cookie + session anonyme fraîche. */
export function enterKiosk() {
  if (typeof document === 'undefined') return;
  setCookie('1', 60 * 60 * 12);
  wipeSession();
}

/** Quitte le mode borne (retour au site). */
export function exitKiosk() {
  if (typeof document === 'undefined') return;
  setCookie('', 0);
  wipeSession();
}

/** Efface panier + jeton + toute donnée saisie sur la borne. */
export function wipeSession() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CART_KEY);
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('bricoloc_kiosk')) localStorage.removeItem(k);
    }
  } catch {
    /* mode privé */
  }
}

/** Compat : ancien nom. */
export const resetKioskSession = wipeSession;

/** true si la borne est active (cookie présent). */
export function useKiosk(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(document.cookie.split('; ').some((c) => c === `${COOKIE}=1`));
  }, []);
  return on;
}
