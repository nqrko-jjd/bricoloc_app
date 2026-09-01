import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@bricoloc/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  },
  async rewrites() {
    // Proxy API pour eviter tout souci CORS en dev.
    return [
      {
        source: '/bricoloc-api/:path*',
        destination: `${process.env.API_URL ?? 'http://localhost:4000'}/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
