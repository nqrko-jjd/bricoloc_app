'use client';
import { useState } from 'react';
import { useCart } from '@/lib/providers';

export function AddToCartButton({
  productId,
  quantity = 1,
  small = false,
  label = 'Ajouter au panier',
  variant = 'primary',
}: {
  productId: string;
  quantity?: number;
  small?: boolean;
  label?: string;
  variant?: 'primary' | 'outline' | 'secondary';
}) {
  const { addItem } = useCart();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');

  async function onClick() {
    setState('busy');
    try {
      await addItem(productId, quantity);
      setState('done');
      setTimeout(() => setState('idle'), 1500);
    } catch {
      setState('idle');
    }
  }

  return (
    <button
      className={`btn btn-${variant}${small ? ' btn-sm' : ''}`}
      onClick={onClick}
      disabled={state === 'busy'}
    >
      {state === 'busy' ? '…' : state === 'done' ? '✔ Ajouté' : label}
    </button>
  );
}
