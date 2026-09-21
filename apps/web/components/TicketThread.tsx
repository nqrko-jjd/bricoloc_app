'use client';
import { useEffect, useRef, useState } from 'react';
import { formatDateTimeBE } from '@bricoloc/shared';

export interface ThreadMessage {
  id: string;
  authorType: string; // CLIENT | STAFF | SYSTEM
  authorName: string | null;
  body: string;
  createdAt: string;
}

/**
 * Petit chat d'un ticket : bulles alignées selon qui regarde (`viewer`),
 * envoi avec Ctrl/⌘+Entrée, défilement automatique sur le dernier message.
 */
export function TicketThread({
  messages,
  viewer,
  onSend,
  placeholder = 'Votre message…',
  disabledNote,
}: {
  messages: ThreadMessage[];
  viewer: 'CLIENT' | 'STAFF';
  onSend: (body: string) => Promise<void>;
  placeholder?: string;
  disabledNote?: string;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function submit() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setErr('');
    try {
      await onSend(body);
      setText('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="thread">
      <div className="thread__list" ref={listRef} aria-live="polite">
        {messages.map((m) => {
          if (m.authorType === 'SYSTEM')
            return (
              <div key={m.id} className="thread__msg thread__msg--system">
                {m.body}
              </div>
            );
          const mine = m.authorType === viewer;
          const who = mine ? 'Vous' : m.authorType === 'STAFF' ? (m.authorName ?? 'BRICOLOC') : (m.authorName ?? 'Client');
          return (
            <div key={m.id} className={`thread__msg${mine ? ' thread__msg--me' : ''}`}>
              {m.body}
              <span className="thread__meta">
                {who} · {formatDateTimeBE(m.createdAt)}
              </span>
            </div>
          );
        })}
      </div>

      {disabledNote ? (
        <p className="small muted">{disabledNote}</p>
      ) : (
        <form
          className="thread__form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            rows={2}
            maxLength={4000}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <button className="btn btn-primary btn-sm" disabled={busy || !text.trim()}>
            {busy ? 'Envoi…' : 'Envoyer'}
          </button>
        </form>
      )}
      {err && <p className="small" style={{ color: 'var(--err)' }}>{err}</p>}
    </div>
  );
}
