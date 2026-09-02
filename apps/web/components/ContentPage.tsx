import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { api } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { PageHeader } from '@/components/PageHeader';
import { Markdown } from '@/components/Markdown';

interface Props {
  contentKey: string;
  fallbackTitle: string;
  intro?: string;
}

/** Liens contextuels affichés dans la colonne latérale, par page. */
const RELATED: Record<string, { href: string; key: string }[]> = {
  'how-it-works': [
    { href: '/livraison', key: 'delivery' },
    { href: '/click-collect', key: 'clickCollect' },
    { href: '/faq', key: 'faq' },
  ],
  faq: [
    { href: '/fonctionnement', key: 'howItWorks' },
    { href: '/livraison', key: 'delivery' },
    { href: '/contact', key: 'contact' },
  ],
  delivery: [
    { href: '/click-collect', key: 'clickCollect' },
    { href: '/fonctionnement', key: 'howItWorks' },
    { href: '/catalogue', key: 'catalogue' },
  ],
  'click-collect': [
    { href: '/livraison', key: 'delivery' },
    { href: '/fonctionnement', key: 'howItWorks' },
    { href: '/catalogue', key: 'catalogue' },
  ],
  pro: [
    { href: '/catalogue', key: 'catalogue' },
    { href: '/fonctionnement', key: 'howItWorks' },
    { href: '/contact', key: 'contact' },
  ],
};

async function fetchContent(key: string, locale: string) {
  try {
    const r = await api<{ content: { title: string | null; body: string } | null }>(
      `/api/public/content/${key}?locale=${locale}`,
      { next: { revalidate: 60 } },
    );
    return r.content;
  } catch {
    return null;
  }
}

export async function contentMetadata(key: string, fallback: string): Promise<Metadata> {
  const locale = await getLocale();
  const c = await fetchContent(key, locale);
  return { title: c?.title ?? fallback };
}

export async function ContentPage({ contentKey, fallbackTitle, intro }: Props) {
  const locale = await getLocale();
  const [content, t, tn] = await Promise.all([
    fetchContent(contentKey, locale),
    getTranslations('contentPage'),
    getTranslations('nav'),
  ]);

  const kicker = t.has(`kicker.${contentKey}`) ? t(`kicker.${contentKey}`) : undefined;
  const related = RELATED[contentKey] ?? [];

  return (
    <>
      <PageHeader kicker={kicker} title={content?.title ?? fallbackTitle} lead={intro} />
      <div className="container page-body page-layout">
        <article className="prose">
          {content ? (
            <Markdown source={content.body} />
          ) : (
            <p className="muted">Contenu à compléter dans l&apos;administration BRICOLOC.</p>
          )}
        </article>

        <aside className="page-aside">
          <div className="page-aside__card">
            <h2>{t('ctaTitle')}</h2>
            <p>{t('ctaText')}</p>
            <Link href="/catalogue" className="btn btn-primary">
              {t('ctaBtn')}
            </Link>
          </div>

          {related.length > 0 && (
            <div className="page-aside__links">
              <span className="kicker">{t('more')}</span>
              {related.map((r) => (
                <Link key={r.href} href={r.href}>
                  {tn(r.key)}
                </Link>
              ))}
            </div>
          )}

          <div className="page-aside__help">
            <strong>{t('help')}</strong>
            <p>{t('helpText')}</p>
            <Link href="/contact">{t('contact')} →</Link>
          </div>
        </aside>
      </div>
    </>
  );
}
