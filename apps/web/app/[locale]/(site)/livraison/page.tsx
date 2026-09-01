import { ContentPage, contentMetadata } from '@/components/ContentPage';
export const dynamic = 'force-dynamic';
export const generateMetadata = () => contentMetadata('delivery', 'Livraison');
export default function Page() {
  return <ContentPage contentKey="delivery" fallbackTitle="Livraison" />;
}
