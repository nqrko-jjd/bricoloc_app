import { cookies } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DateRangeBar } from '@/components/DateRangeBar';
import { Reveal } from '@/components/Reveal';
import { KioskShell } from '@/components/kiosk/KioskShell';

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Mode borne : plein écran, coque tactile, ni en-tête ni pied de page.
  const kiosk = (await cookies()).get('bricoloc_kiosk')?.value === '1';
  if (kiosk) {
    return (
      <KioskShell>
        <main>{children}</main>
        <Reveal />
      </KioskShell>
    );
  }

  return (
    <>
      <Header />
      <DateRangeBar />
      <main>{children}</main>
      <Footer />
      <Reveal />
    </>
  );
}
