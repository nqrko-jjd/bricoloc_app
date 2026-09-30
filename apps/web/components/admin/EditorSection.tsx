import type { ReactNode } from 'react';

export function EditorSection({ title, hint, open = false, children }: {
  title: string; hint?: string; open?: boolean; children: ReactNode;
}) {
  return <details className="editor-section" open={open}>
    <summary><span><strong>{title}</strong>{hint && <small>{hint}</small>}</span><span className="editor-section__toggle" aria-hidden="true">+</span></summary>
    <div className="editor-section__body stack">{children}</div>
  </details>;
}
