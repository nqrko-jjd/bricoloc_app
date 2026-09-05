import { redirect } from '@/i18n/navigation';

/** Fusionné dans /admin/etiquettes (même usage : impression d'étiquettes QR). */
export default async function AdminEmplacementsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: '/admin/etiquettes', locale });
}
