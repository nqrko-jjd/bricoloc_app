import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Remplaçants localisés de `next/link` et des hooks de navigation.
 * À utiliser partout à la place de `next/link` : les liens portent
 * automatiquement le préfixe de langue courant.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
