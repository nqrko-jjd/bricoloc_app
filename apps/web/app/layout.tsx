import type { ReactNode } from 'react';

/**
 * Layout racine minimal : le vrai <html>/<body> vit dans app/[locale]/layout.tsx
 * (nécessaire pour que la langue soit connue avant le rendu).
 * Ce fichier reste requis par Next (présence d'un not-found racine).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
