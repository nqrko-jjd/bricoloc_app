import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

interface Props {
  contentKey: string;
  fallbackTitle: string;
  intro?: string;
}

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
  const content = await fetchContent(contentKey, locale);
  return (
    <>
      <PageHeader title={content?.title ?? fallbackTitle} lead={intro} />
      <div className="container page-body" style={{ maxWidth: 820 }}>
        <div className="card card-pad">
          {content ? (
            content.body.split('\n').map((line, i) => (
              <p key={i} style={{ margin: line.trim() ? '0 0 0.6em' : '0.4em 0' }}>
                {line}
              </p>
            ))
          ) : (
            <p className="muted">Contenu à compléter dans l&apos;administration BRICOLOC.</p>
          )}
        </div>
      </div>
    </>
  );
}
