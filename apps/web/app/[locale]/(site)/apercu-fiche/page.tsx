import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductDesignPreview } from '@/components/ProductDesignPreview';
import './preview.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Proposition de fiche produit', robots: { index: false, follow: false } };

export default function ProductPreviewPage() {
  // Review-only route: never exposed by a production build.
  if (process.env.NODE_ENV === 'production') notFound();
  return <ProductDesignPreview />;
}
