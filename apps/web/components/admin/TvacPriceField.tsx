'use client';
import { useEffect, useRef, useState } from 'react';
import { round2, formatEUR } from '@bricoloc/shared';

/**
 * Logique d'un champ de prix saisi en TVAC (celui que le client paie) mais
 * stocké en HTVA en interne (base de la dégressivité, de la facturation, des
 * comptes PRO). Le texte tapé reste local tant que l'utilisateur édite ce
 * champ (jamais recalculé sous ses doigts) ; il ne se resynchronise que
 * quand `htValue` change pour une autre raison (chargement d'une fiche,
 * bouton auto-remplir).
 */
export function useTvacPriceField(htValue: number, onHtChange: (ht: number) => void, vatRate: number) {
  const toTvacText = (ht: number) => (ht > 0 ? String(round2(ht * (1 + vatRate))) : '');
  const [text, setText] = useState(() => toTvacText(htValue));
  const lastHt = useRef(htValue);

  useEffect(() => {
    if (htValue !== lastHt.current) {
      setText(toTvacText(htValue));
      lastHt.current = htValue;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [htValue, vatRate]);

  function onChange(raw: string) {
    setText(raw);
    const n = Number(raw.replace(',', '.'));
    const ht = raw.trim() === '' || !Number.isFinite(n) ? 0 : round2(n / (1 + vatRate));
    lastHt.current = ht;
    onHtChange(ht);
  }

  return { text, onChange, hint: htValue > 0 ? `= ${formatEUR(htValue)} HTVA` : null };
}

/** Champ TVAC prêt à l'emploi (input + indication HTVA en dessous). */
export function TvacPriceField({
  htValue,
  onHtChange,
  vatRate,
  placeholder,
}: {
  htValue: number;
  onHtChange: (ht: number) => void;
  vatRate: number;
  placeholder?: string;
}) {
  const { text, onChange, hint } = useTvacPriceField(htValue, onHtChange, vatRate);
  return (
    <>
      <input
        type="number"
        step="0.01"
        value={text}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="small muted">{hint}</span>}
    </>
  );
}
