'use client';

import { useRouter } from '@/i18n/navigation';
import { useState } from 'react';
import { formatEUR } from '@bricoloc/shared';
import { useCart } from '@/lib/providers';

export function ReservePack({ packId, price }: { packId: string; price: number }) {
  const { addItem } = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reserve() {
    setBusy(true);
    try {
      await addItem(packId, 1);
      router.push('/commande');
    } catch {
      setBusy(false);
    }
  }

  return (
    <button className="btn btn-primary btn-lg bpd-reserve__btn" onClick={reserve} disabled={busy}>
      {busy ? '…' : `Réserver ce BricoPack — ${formatEUR(price)}/j`}
    </button>
  );
}
