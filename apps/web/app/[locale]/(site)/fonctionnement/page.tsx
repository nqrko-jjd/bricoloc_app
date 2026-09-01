import { ContentPage, contentMetadata } from '@/components/ContentPage';
export const dynamic = 'force-dynamic';
export const generateMetadata = () => contentMetadata('how-it-works', 'Comment ça marche');
export default function Page() {
  return <ContentPage contentKey="how-it-works" fallbackTitle="Comment ça marche" />;
}
