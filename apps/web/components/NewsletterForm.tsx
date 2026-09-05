'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { clientApi, ApiError } from '@/lib/api';

export function NewsletterForm({ source }: { source: string }) {
  const t = useTranslations('appPage');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('busy');
    setError('');
    try {
      await clientApi('/api/public/newsletter', {
        method: 'POST',
        auth: 'none',
        body: { email, source, locale },
      });
      setState('done');
    } catch (err) {
      setState('error');
      setError(err instanceof ApiError ? err.message : 'Erreur, réessayez.');
    }
  }

  if (state === 'done') {
    return <p className="newsletter__done">✓ {t('newsletterDone')}</p>;
  }

  return (
    <form className="newsletter" onSubmit={submit}>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('newsletterPlaceholder')}
        disabled={state === 'busy'}
      />
      <button type="submit" className="btn btn-primary btn-lg" disabled={state === 'busy'}>
        {state === 'busy' ? '…' : t('newsletterCta')}
      </button>
      {state === 'error' && <p className="newsletter__error">{error}</p>}
    </form>
  );
}
