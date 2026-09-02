import type { Metadata, Viewport } from 'next';
import { TerminalGate } from '@/components/terminal/TerminalGate';

export const metadata: Metadata = {
  title: 'Terminal équipe',
  robots: { index: false, follow: false },
  manifest: '/terminal.webmanifest',
  appleWebApp: { capable: true, title: 'Bricoloc Terminal', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#08065d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return <TerminalGate>{children}</TerminalGate>;
}
