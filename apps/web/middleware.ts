import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

export default function middleware(req: NextRequest) {
  const res = intl(req);
  // Mode borne : dès qu'on est sous /borne, on pose le cookie (lu par le layout
  // (site) pour afficher la coque tactile plein écran). Il persiste ensuite sur
  // /catalogue, /commande… jusqu'à « Quitter » (qui l'efface côté client).
  const path = req.nextUrl.pathname;
  const onBorne =
    path === '/borne' ||
    path.startsWith('/borne/') ||
    /^\/(?:nl|en)\/borne(?:\/|$)/.test(path);
  if (onBorne) {
    res.cookies.set('bricoloc_kiosk', '1', {
      path: '/',
      maxAge: 60 * 60 * 12,
      sameSite: 'lax',
    });
  }
  return res;
}

export const config = {
  // Tout sauf les routes internes Next, l'API proxy et les fichiers statiques.
  matcher: ['/((?!api|bricoloc-api|_next|_vercel|.*\\..*).*)'],
};
