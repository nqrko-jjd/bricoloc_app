'use client';
import { useState } from 'react';

const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
  ['W', 'X', 'C', 'V', 'B', 'N', '@', '.', '-', '_'],
];

export function OnScreenKeyboard({
  value,
  onChange,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
}) {
  const [caps, setCaps] = useState(true);
  const press = (k: string) => onChange(value + (caps ? k : k.toLowerCase()));
  return (
    <div>
      <div
        style={{
          background: '#fff',
          color: 'var(--navy-deep)',
          border: '2px solid var(--navy)',
          borderRadius: 14,
          padding: '14px 18px',
          fontSize: '1.4rem',
          fontWeight: 700,
          minHeight: 56,
          textAlign: 'left',
          wordBreak: 'break-all',
        }}
      >
        {value || <span style={{ opacity: 0.3 }}>…</span>}
      </div>
      <div className="kiosk-keyboard">
        {ROWS.flat().map((k) => (
          <button key={k} type="button" className="kiosk-key" onClick={() => press(k)}>
            {caps ? k : k.toLowerCase()}
          </button>
        ))}
        <button type="button" className="kiosk-key wide" onClick={() => setCaps((c) => !c)}>
          ⇪
        </button>
        <button type="button" className="kiosk-key wide" onClick={() => onChange(value + ' ')}>
          Espace
        </button>
        <button
          type="button"
          className="kiosk-key wide"
          onClick={() => onChange(value.slice(0, -1))}
        >
          ⌫
        </button>
        {onEnter && (
          <button
            type="button"
            className="kiosk-key"
            style={{ background: 'var(--brico)', color: '#fff' }}
            onClick={onEnter}
          >
            OK
          </button>
        )}
      </div>
    </div>
  );
}
