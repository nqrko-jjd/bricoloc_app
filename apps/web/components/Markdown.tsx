import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

/**
 * Rendu Markdown minimal, sans dépendance, pour les pages de contenu éditables
 * dans l'administration. Gère : titres (##, ###), listes (-, *, 1.), gras **…**,
 * italique *…*, liens [texte](url), séparateurs (---), paragraphes.
 */

function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[1]) nodes.push(<strong key={key}>{m[1]}</strong>);
    else if (m[2]) nodes.push(<em key={key}>{m[2]}</em>);
    else if (m[3]) {
      const href = m[4];
      nodes.push(
        href.startsWith('/') ? (
          <Link key={key} href={href}>
            {m[3]}
          </Link>
        ) : (
          <a key={key} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
            {m[3]}
          </a>
        ),
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  let k = 0;

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{renderInline(it, `li-${k}-${i}`)}</li>);
    blocks.push(list.ordered ? <ol key={k++}>{items}</ol> : <ul key={k++}>{items}</ul>);
    list = null;
  };
  const flushPara = () => {
    if (!para.length) return;
    const text = para.join(' ');
    blocks.push(<p key={k++}>{renderInline(text, `p-${k}`)}</p>);
    para = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    if (line === '---') {
      flushPara();
      flushList();
      blocks.push(<hr key={k++} />);
      continue;
    }
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      flushPara();
      flushList();
      const level = h[1].length;
      blocks.push(
        level === 2 ? (
          <h2 key={k++}>{renderInline(h[2], `h-${k}`)}</h2>
        ) : (
          <h3 key={k++}>{renderInline(h[2], `h-${k}`)}</h3>
        ),
      );
      continue;
    }
    const ol = line.match(/^(\d+)[.)]\s+(.*)$/);
    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ol || ul) {
      flushPara();
      const ordered = Boolean(ol);
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((ol ? ol[2] : ul![1]).trim());
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();

  return <>{blocks}</>;
}
