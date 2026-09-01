import { setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DateRangeBar } from '@/components/DateRangeBar';

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Header />
      <DateRangeBar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
