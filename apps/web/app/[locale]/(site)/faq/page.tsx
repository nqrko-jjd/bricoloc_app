import { ContentPage, contentMetadata } from '@/components/ContentPage';
export const dynamic = 'force-dynamic';
export const generateMetadata = () => contentMetadata('faq', 'Questions fréquentes');
export default function Page() {
  return <ContentPage contentKey="faq" fallbackTitle="Questions fréquentes" />;
}
