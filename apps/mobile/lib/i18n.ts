/**
 * i18n compact pour l'appli mobile (FR / NL / EN).
 * Langue = celle de l'appareil, forçable via AsyncStorage `bricoloc_locale`.
 * Les contenus produits/catalogue restent traduits côté API (`?locale=`).
 */
import { getLocales } from 'expo-localization';

export type Locale = 'fr' | 'nl' | 'en';
export const LOCALES: Locale[] = ['fr', 'nl', 'en'];

const M: Record<Locale, Record<string, string>> = {
  fr: {
    'tab.home': 'Louer',
    'tab.cart': 'Panier',
    'tab.reservations': 'Réservations',
    'tab.account': 'Compte',
    'common.book': 'Réserver',
    'common.add': 'Ajouter au panier',
    'common.login': 'Se connecter',
    'common.logout': 'Se déconnecter',
    'common.loading': 'Chargement…',
    'common.perDay': '/ jour',
    'common.deposit': 'Caution',
    'home.title': 'Le bon outil. Au bon moment.',
    'home.subtitle': 'Réservez machines et outillage. Retrait au dépôt ou livraison.',
    'home.search': 'Rechercher une machine…',
    'home.scan': 'Scanner un QR / code-barres',
    'scan.title': 'Scanner',
    'scan.hint': 'Visez le QR code de votre réservation ou l’étiquette d’une machine.',
    'scan.permission': 'Autorisez l’accès à la caméra pour scanner.',
    'scan.notFound': 'Code non reconnu.',
    'reviews.title': 'Avis clients',
    'reviews.none': 'Aucun avis pour l’instant.',
    'reviews.write': 'Donner mon avis',
    'reviews.rating': 'Votre note',
    'reviews.body': 'Votre avis',
    'reviews.submit': 'Publier',
    'reviews.thanks': 'Merci pour votre avis !',
    'account.notifications': 'Notifications',
    'account.language': 'Langue',
  },
  nl: {
    'tab.home': 'Huren',
    'tab.cart': 'Mandje',
    'tab.reservations': 'Reserveringen',
    'tab.account': 'Account',
    'common.book': 'Reserveren',
    'common.add': 'In winkelmandje',
    'common.login': 'Aanmelden',
    'common.logout': 'Afmelden',
    'common.loading': 'Laden…',
    'common.perDay': '/ dag',
    'common.deposit': 'Borg',
    'home.title': 'Het juiste gereedschap. Op het juiste moment.',
    'home.subtitle': 'Reserveer machines en gereedschap. Afhalen of levering.',
    'home.search': 'Zoek een machine…',
    'home.scan': 'Scan een QR / streepjescode',
    'scan.title': 'Scannen',
    'scan.hint': 'Richt op de QR-code van uw reservering of het etiket van een machine.',
    'scan.permission': 'Geef toegang tot de camera om te scannen.',
    'scan.notFound': 'Code niet herkend.',
    'reviews.title': 'Klantbeoordelingen',
    'reviews.none': 'Nog geen beoordelingen.',
    'reviews.write': 'Mijn beoordeling geven',
    'reviews.rating': 'Uw beoordeling',
    'reviews.body': 'Uw beoordeling',
    'reviews.submit': 'Plaatsen',
    'reviews.thanks': 'Bedankt voor uw beoordeling!',
    'account.notifications': 'Meldingen',
    'account.language': 'Taal',
  },
  en: {
    'tab.home': 'Rent',
    'tab.cart': 'Cart',
    'tab.reservations': 'Bookings',
    'tab.account': 'Account',
    'common.book': 'Book',
    'common.add': 'Add to cart',
    'common.login': 'Log in',
    'common.logout': 'Log out',
    'common.loading': 'Loading…',
    'common.perDay': '/ day',
    'common.deposit': 'Deposit',
    'home.title': 'The right tool. At the right time.',
    'home.subtitle': 'Book machines and tools. Depot pickup or delivery.',
    'home.search': 'Search for a machine…',
    'home.scan': 'Scan a QR / barcode',
    'scan.title': 'Scan',
    'scan.hint': 'Point at your booking QR code or a machine label.',
    'scan.permission': 'Allow camera access to scan.',
    'scan.notFound': 'Code not recognised.',
    'reviews.title': 'Customer reviews',
    'reviews.none': 'No reviews yet.',
    'reviews.write': 'Write a review',
    'reviews.rating': 'Your rating',
    'reviews.body': 'Your review',
    'reviews.submit': 'Post',
    'reviews.thanks': 'Thanks for your review!',
    'account.notifications': 'Notifications',
    'account.language': 'Language',
  },
};

let override: Locale | null = null;
export function setLocaleOverride(l: Locale | null) {
  override = l;
}

export function currentLocale(): Locale {
  if (override) return override;
  const dev = getLocales()[0]?.languageCode as Locale | undefined;
  return dev && LOCALES.includes(dev) ? dev : 'fr';
}

export function t(key: keyof (typeof M)['fr']): string {
  const l = currentLocale();
  return M[l][key] ?? M.fr[key] ?? key;
}
