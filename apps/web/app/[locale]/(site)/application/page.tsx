import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'appPage' });
  return { title: `${t('title')} ${t('accent')}`, description: t('lead') };
}

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('appPage');

  const features = [
    ['f1title', 'f1text'],
    ['f2title', 'f2text'],
    ['f3title', 'f3text'],
  ] as const;

  return (
    <div className="container page-body appviz">
      <header className="appviz__hero">
        <span className="eyebrow">{t('eyebrow')}</span>
        <h1>
          {t('title')} <em>{t('accent')}</em>
        </h1>
        <p>{t('lead')}</p>
        <div className="appviz__stores">
          <span className="appviz__store">
            <small>{t('soon')}</small>
            {t('appstore')}
          </span>
          <span className="appviz__store">
            <small>{t('soon')}</small>
            {t('playstore')}
          </span>
        </div>
      </header>

      <div className="appviz__screens" aria-hidden>
        <div className="appviz__screen">
          <strong>BRICOLOC.</strong>
          <p>
            {t('s1a')} 👋
            <br />
            {t('s1b')}
          </p>
          <span className="appviz__pill">{t('s1pill')}</span>
        </div>
        <div className="appviz__screen">
          <strong>{t('s2a')}</strong>
          <p>{t('s2b')}</p>
          <span className="appviz__pill">{t('s2pill')}</span>
        </div>
      </div>

      <div className="appviz__features">
        {features.map(([title, text]) => (
          <div key={title} className="appviz__feature">
            <h3>{t(title)}</h3>
            <p>{t(text)}</p>
          </div>
        ))}
      </div>

      <section className="home-cta" style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        <div className="home-cta__bg" aria-hidden />
        <div className="container home-cta__inner">
          <h2>{t('ctaTitle')}</h2>
          <p>{t('ctaText')}</p>
          <Link href="/catalogue" className="btn btn-primary btn-lg">
            {t('ctaBtn')}
          </Link>
        </div>
      </section>
    </div>
  );
}
