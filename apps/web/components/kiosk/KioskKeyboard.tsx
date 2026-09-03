'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
  ['w', 'x', 'c', 'v', 'b', 'n', "'", '-', '@', '.'],
];

type Target = HTMLInputElement | HTMLTextAreaElement;

/** Écrit dans un input/textarea React en déclenchant onChange. */
function setValue(el: Target, next: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, next);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

const TYPES = new Set(['text', 'search', 'email', 'tel', 'number', 'url', '']);

/**
 * Clavier tactile global : apparaît en bas de l'écran dès qu'un champ texte est
 * sélectionné dans la borne, disparaît sinon. Tape directement dans le champ.
 */
export function KioskKeyboard() {
  const [el, setEl] = useState<Target | null>(null);
  const [caps, setCaps] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onFocus(e: FocusEvent) {
      const target = e.target as HTMLElement | null;
      if (barRef.current?.contains(target)) return;
      if (
        (target instanceof HTMLInputElement && TYPES.has(target.type)) ||
        target instanceof HTMLTextAreaElement
      ) {
        if (target.readOnly || target.disabled) return;
        setEl(target);
      }
    }
    function onFocusOut(e: FocusEvent) {
      // Clic sur une touche : ne pas fermer.
      if (barRef.current?.contains(e.relatedTarget as Node)) return;
      setTimeout(() => {
        const a = document.activeElement;
        if (!(a instanceof HTMLInputElement) && !(a instanceof HTMLTextAreaElement)) setEl(null);
      }, 50);
    }
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  const press = useCallback(
    (k: string) => {
      if (!el) return;
      setValue(el, (el.value ?? '') + (caps ? k.toUpperCase() : k));
      el.focus();
    },
    [el, caps],
  );

  if (!el) return null;

  return (
    <div className="kioskm-kb" ref={barRef} onPointerDown={(e) => e.preventDefault()}>
      {ROWS.map((row, r) => (
        <div key={r} className="kioskm-kb__row">
          {r === 3 && (
            <button
              className={`kioskm-kb__k kioskm-kb__k--wide${caps ? ' is-on' : ''}`}
              onClick={() => setCaps((c) => !c)}
            >
              ⇧
            </button>
          )}
          {row.map((k) => (
            <button key={k} className="kioskm-kb__k" onClick={() => press(k)}>
              {caps ? k.toUpperCase() : k}
            </button>
          ))}
          {r === 3 && (
            <button
              className="kioskm-kb__k kioskm-kb__k--wide"
              onClick={() => el && setValue(el, el.value.slice(0, -1))}
            >
              ⌫
            </button>
          )}
        </div>
      ))}
      <div className="kioskm-kb__row">
        <button className="kioskm-kb__k kioskm-kb__k--space" onClick={() => press(' ')}>
          espace
        </button>
        <button className="kioskm-kb__k kioskm-kb__k--wide" onClick={() => el?.blur()}>
          OK
        </button>
      </div>
    </div>
  );
}
