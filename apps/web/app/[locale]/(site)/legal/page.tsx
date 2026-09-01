import { ContentPage, contentMetadata } from '@/components/ContentPage';
export const dynamic = 'force-dynamic';
export const generateMetadata = () => contentMetadata('legal', 'Mentions légales');
export default function Page() {
  return <ContentPage contentKey="legal" fallbackTitle="Mentions légales" />;
}
