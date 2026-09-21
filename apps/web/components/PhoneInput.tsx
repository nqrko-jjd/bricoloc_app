'use client';
import type { InputHTMLAttributes } from 'react';
import { sanitizePhone } from '@bricoloc/shared';

/** Champ téléphone : clavier numérique sur mobile, remplissage auto, seuls les caractères d'un n° passent. */
export function PhoneInput({
  value,
  onValueChange,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onValueChange: (v: string) => void;
}) {
  return (
    <input
      {...rest}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder={rest.placeholder ?? '+32 470 12 34 56'}
      value={value}
      onChange={(e) => onValueChange(sanitizePhone(e.target.value))}
    />
  );
}
