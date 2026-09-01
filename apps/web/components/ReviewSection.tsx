'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { API_URL, clientApi } from '@/lib/api';
import { useSession } from '@/lib/providers';
import { StarRating } from './StarRating';

interface Review {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  reply: string | null;
  publishedAt: string | null;
}
interface Summary {
  avg: number;
  count: number;
  distribution: { star: number; count: number }[];
}

export function ReviewSection({ slug }: { slug: string }) {
  const t = useTranslations('product');
  const { user } = useSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [form, setForm] = useState({ authorName: '', rating: 5, title: '', body: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`${API_URL}/api/products/${slug}/reviews`, { cache: 'no-store' });
    const json = await res.json();
    setSummary(json.summary);
    setReviews(json.reviews);
  }
  useEffect(() => {
    load();
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await clientApi<{ message: string; status: string }>('/api/reviews', {
        method: 'POST',
        auth: user ? 'user' : 'none',
        body: {
          productSlug: slug,
          rating: form.rating,
          title: form.title || undefined,
          body: form.body,
          authorName: user ? undefined : form.authorName || undefined,
        },
      });
      setDone(res.status === 'PUBLISHED' ? t('reviewThanks') : t('reviewModerated'));
      setOpen(false);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="reviews" id="avis">
      <div className="spread">
        <h2>{t('reviewsTitle')}</h2>
        {!done && (
          <button className="btn btn-outline btn-sm" onClick={() => setOpen((v) => !v)}>
            {t('writeReview')}
          </button>
        )}
      </div>

      {summary && summary.count > 0 ? (
        <div className="reviews__summary">
          <div className="reviews__score">
            <strong>{summary.avg.toFixed(1)}</strong>
            <StarRating value={summary.avg} size={18} />
            <span className="small muted">{t('basedOn', { count: summary.count })}</span>
          </div>
          <ul className="reviews__dist">
            {summary.distribution.map((d) => (
              <li key={d.star}>
                <span>{d.star}★</span>
                <span className="bar">
                  <span
                    style={{ width: `${summary.count ? (d.count / summary.count) * 100 : 0}%` }}
                  />
                </span>
                <span className="small muted">{d.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted">{t('noReviews')}</p>
      )}

      {done && <p className="alert alert-ok">{done}</p>}

      {open && (
        <form className="reviews__form card card-pad" onSubmit={submit}>
          {!user && (
            <div className="field">
              <label>{t('reviewName')}</label>
              <input
                required
                value={form.authorName}
                onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
              />
            </div>
          )}
          <div className="field">
            <label>{t('reviewRating')}</label>
            <div className="rating-input">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  className={n <= form.rating ? 'is-on' : ''}
                  onClick={() => setForm((f) => ({ ...f, rating: n }))}
                  aria-label={`${n}/5`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>{t('reviewTitle')}</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>{t('reviewBody')}</label>
            <textarea
              required
              rows={4}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
          </div>
          {err && <p className="alert alert-err small">{err}</p>}
          <button className="btn btn-primary" disabled={busy}>
            {t('reviewSubmit')}
          </button>
        </form>
      )}

      <ul className="reviews__list">
        {reviews.map((r) => (
          <li key={r.id} className="card card-body">
            <div className="spread">
              <strong>{r.authorName}</strong>
              <StarRating value={r.rating} />
            </div>
            {r.title && <p className="reviews__rtitle">{r.title}</p>}
            <p>{r.body}</p>
            {r.publishedAt && (
              <span className="small muted">
                {new Date(r.publishedAt).toLocaleDateString('fr-BE')}
              </span>
            )}
            {r.reply && (
              <div className="reviews__reply">
                <strong className="small">{t('reply')}</strong>
                <p className="small">{r.reply}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
