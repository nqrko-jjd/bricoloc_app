import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Tout sauf les routes internes Next, l'API proxy et les fichiers statiques.
  matcher: ['/((?!api|bricoloc-api|_next|_vercel|.*\\..*).*)'],
};
