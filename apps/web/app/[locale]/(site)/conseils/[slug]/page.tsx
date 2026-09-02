import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import type { GuideDetail, ProductSummary } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';

export const dynamic = 'force-dynamic';

async function load(slug: string, locale: string) {
  try {
    return await api<{ guide: GuideDetail; related: ProductSummary[] }>(
      `/api/public/guides/${slug}?locale=${locale}`,
      { next: { revalidate: 120 } },
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const data = await load(slug, locale);
  if (!data) return { title: 'Article introuvable' };
  const g = data.guide;
  return {
    title: g.seo?.title || g.title,
    description: g.seo?.description || g.excerpt,
    openGraph: { title: g.title, description: g.excerpt, type: 'article' },
  };
}

/** Rendu simple : "## " = sous-titre, "- " = liste, sinon paragraphe. */
function renderBody(body: string) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (i: number) => {
    if (list.length) {
      blocks.push(
        <ul key={`ul-${i}`}>
          {list.map((li, k) => (
            <li key={k}>{li.replace(/^\*\*(.+?)\*\*/, '$1')}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  body.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) {
      flush(i);
      return;
    }
    if (line.startsWith('## ')) {
      flush(i);
      blocks.push(<h2 key={i}>{line.slice(3)}</h2>);
    } else if (line.startsWith('- ')) {
      list.push(line.slice(2));
    } else {
      flush(i);
      blocks.push(<p key={i}>{line}</p>);
    }
  });
  flush(999);
  return blocks;
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const data = await load(slug, locale);
  if (!data) notFound();
  const { guide, related } = data;
  const t = await getTranslations('guides');

  const catLabel = (() => {
    try {
      return t(`cat_${guide.category}` as never) as string;
    } catch {
      return guide.category;
    }
  })();

  return (
    <article className="guide-article">
      <header className="guide-article__head" data-tone={guide.tone}>
        <div className="container">
          <Link href="/conseils" className="guide-article__back">
            ← {t('allGuides')}
          </Link>
          <span className="guide-article__meta">
            {catLabel} · ◷ {guide.readMinutes} {t('min')}
          </span>
          <h1>{guide.title}</h1>
          <p className="guide-article__lead">{guide.excerpt}</p>
        </div>
      </header>

      <div className="container guide-article__body measure">{renderBody(guide.body)}</div>

      {related.length > 0 && (
        <section className="section container">
          <h2>{t('related')}</h2>
          <div className="grid grid-cards carousel" style={{ marginTop: 18 }}>
            {related.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
