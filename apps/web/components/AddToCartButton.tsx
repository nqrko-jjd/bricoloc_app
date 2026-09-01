'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCart } from '@/lib/providers';

export function AddToCartButton({
  productId,
  quantity = 1,
  small = false,
  label,
  variant = 'primary',
}: {
  productId: string;
  quantity?: number;
  small?: boolean;
  label?: string;
  variant?: 'primary' | 'outline' | 'secondary';
}) {
  const { addItem } = useCart();
  const t = useTranslations('catalogue');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const text = label ?? t('addToCart');

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
      {state === 'busy' ? '…' : state === 'done' ? '✔' : text}
    </button>
  );
}
