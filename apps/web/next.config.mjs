import { fileURLToPath } from 'node:url';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@bricoloc/shared'],
  // Sortie autonome pour l'image Docker de production (dossier .next/standalone).
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  // Autorise l'accès en dev depuis un tunnel HTTPS (test caméra sur iPad / borne / téléphone)
  // et depuis le réseau local. Sans effet en production.
  allowedDevOrigins: [
    '*.trycloudflare.com',
    '*.ngrok-free.app',
    '*.ngrok.io',
    '*.loca.lt',
    '192.168.1.27',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? '',
  },
  async rewrites() {
    // Proxy API pour eviter tout souci CORS en dev.
    const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    return [
      {
        source: '/bricoloc-api/:path*',
        destination: `${apiUrl}/:path*`,
      },
      {
        // Images / médias produits : servis par l'API, proxyés sur l'origine du
        // site pour charger depuis n'importe quel appareil (téléphone, iPad, borne).
        source: '/uploads/:path*',
        destination: `${apiUrl}/uploads/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
