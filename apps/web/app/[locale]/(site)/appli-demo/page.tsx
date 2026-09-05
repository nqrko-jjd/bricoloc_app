import type { Metadata } from 'next';
import { AppDemo } from '@/components/appdemo/AppDemo';

export const metadata: Metadata = { title: 'Démo appli · BRICOLOC', robots: { index: false } };

export default function AppliDemoPage() {
  return <AppDemo />;
}
