import { ContentPage, contentMetadata } from '@/components/ContentPage';
export const dynamic = 'force-dynamic';
export const generateMetadata = () => contentMetadata('click-collect', 'Click & Collect');
export default function Page() {
  return <ContentPage contentKey="click-collect" fallbackTitle="Click & Collect" />;
}
