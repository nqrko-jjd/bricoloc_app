import { ContentPage, contentMetadata } from '@/components/ContentPage';
export const dynamic = 'force-dynamic';
export const generateMetadata = () => contentMetadata('pro', 'Services pour les professionnels');
export default function Page() {
  return <ContentPage contentKey="pro" fallbackTitle="Services pour les professionnels" />;
}
