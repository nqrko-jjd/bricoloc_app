import type { Metadata } from 'next';
import { api } from '@/lib/api';

interface Props {
  contentKey: string;
  fallbackTitle: string;
  intro?: string;
}

async function fetchContent(key: string) {
  try {
    const r = await api<{ content: { title: string | null; body: string } | null }>(
      `/api/public/content/${key}`,
    );
    return r.content;
  } catch {
    return null;
  }
}

export async function contentMetadata(key: string, fallback: string): Promise<Metadata> {
  const c = await fetchContent(key);
  return { title: c?.title ?? fallback };
}

export async function ContentPage({ contentKey, fallbackTitle, intro }: Props) {
  const content = await fetchContent(contentKey);
  return (
    <div className="section container" style={{ maxWidth: 780 }}>
      <h1>{content?.title ?? fallbackTitle}</h1>
      {intro && <p className="muted">{intro}</p>}
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
  );
}
