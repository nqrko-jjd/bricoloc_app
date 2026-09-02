'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Search, ArrowUpRight } from './icons';

export function HomeSearch({ placeholder, cta }: { placeholder: string; cta: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');

  function go() {
    router.push(q.trim() ? `/catalogue?q=${encodeURIComponent(q.trim())}` : '/catalogue');
  }

  return (
    <form
      className="csearch"
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
    >
      <Search />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <button type="submit">
        {cta} <ArrowUpRight />
      </button>
    </form>
  );
}
