'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export interface AddressPick {
  line1: string;
  postalCode: string;
  city: string;
  lat?: number;
  lng?: number;
}
interface Suggestion extends AddressPick {
  label: string;
}

/**
 * Champ « Rue et numéro » avec propositions d'adresses (type Google Maps),
 * basé sur OpenStreetMap (endpoint /api/geo/autocomplete). À la sélection,
 * remplit rue+n°, code postal et ville via `onPick`.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onPick,
  placeholder = 'Commencez à taper la rue…',
}: {
  value: string;
  onChange: (line1: string) => void;
  onPick: (a: AddressPick) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const justPicked = useRef(false);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    const term = value.trim();
    if (term.length < 3) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api<{ suggestions: Suggestion[] }>(
          `/api/geo/autocomplete?q=${encodeURIComponent(term)}`,
        );
        if (!ctrl.signal.aborted) {
          setItems(r.suggestions);
          setActive(-1);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [value]);

  function pick(s: Suggestion) {
    justPicked.current = true;
    onChange(s.line1);
    onPick({ line1: s.line1, postalCode: s.postalCode, city: s.city, lat: s.lat, lng: s.lng });
    setOpen(false);
  }

  const show = open && (items.length > 0 || (loading && value.trim().length >= 3));

  return (
    <div ref={boxRef} className="search-ac search-ac--plain addr-ac">
      <div className="search-ac__bar">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 21s-7-5.686-7-11a7 7 0 1 1 14 0c0 5.314-7 11-7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        <input
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, -1));
            } else if (e.key === 'Enter' && active >= 0) {
              e.preventDefault();
              pick(items[active]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
      </div>
      {show && (
        <div className="search-ac__panel" role="listbox">
          {items.map((s, i) => (
            <button
              key={s.label + i}
              type="button"
              role="option"
              aria-selected={active === i}
              className={`search-ac__item search-ac__item--cat${active === i ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(s)}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 21s-7-5.686-7-11a7 7 0 1 1 14 0c0 5.314-7 11-7 11z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              <span className="search-ac__name">{s.label}</span>
            </button>
          ))}
          {items.length === 0 && loading && (
            <p className="search-ac__head" style={{ padding: '10px' }}>Recherche…</p>
          )}
        </div>
      )}
    </div>
  );
}
