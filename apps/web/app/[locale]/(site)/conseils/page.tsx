import { ContentPage, contentMetadata } from '@/components/ContentPage';
export const dynamic = 'force-dynamic';
export const generateMetadata = () => contentMetadata('conseils', 'Conseils & SAV');
export default function Page() {
  return <ContentPage contentKey="conseils" fallbackTitle="Conseils & SAV" />;
}
