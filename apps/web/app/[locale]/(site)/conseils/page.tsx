import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { GuideSummary } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { GuideFilter } from '@/components/GuideFilter';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'guides' });
  return { title: `${t('title')} ${t('accent')}`, description: t('lead') };
}

export default async function ConseilsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('guides');
  const { guides, categories } = await api<{ guides: GuideSummary[]; categories: string[] }>(
    `/api/public/guides?locale=${locale}`,
    { next: { revalidate: 120 } },
  );

  return (
    <>
      <PageHeader title={t('title')} titleAccent={t('accent')} lead={t('lead')} />
      <div className="container page-body">
        <GuideFilter guides={guides} categories={categories} />
      </div>
    </>
  );
}
