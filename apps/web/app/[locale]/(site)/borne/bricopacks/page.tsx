'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { formatEUR, type Locale } from '@bricoloc/shared';
import { api } from '@/lib/api';
import { useCart } from '@/lib/providers';
import { useRouter } from '@/i18n/navigation';
import { PLACEHOLDER_IMG } from '@/lib/placeholder';

type PackRow = {
  slug: string;
  name: string;
  intro: string;
  popular: boolean;
  dailyPrice: number;
  separateTotal: number | null;
  toolCount: number;
  image: string | null;
};
type PackDetail = {
  id: string;
  slug: string;
  name: string;
  intro: string;
  dailyPrice: number;
  separateTotal: number;
  savingPerDay: number;
  items: { slug: string; role: string | null; why: string | null; name: string; dailyPrice: number; image: string | null }[];
  consumables: { name: string }[];
};

const T: Record<Locale, Record<string, string>> = {
  fr: {
    back: '← Accueil',
    title: 'BricoPacks',
    sub: 'Tout le matériel d’un chantier, réuni et à prix réduit.',
    popular: 'Populaire',
    tools: 'outils',
    perDay: '/ jour',
    instead: 'au lieu de',
    save: 'Économie',
    included: 'Dans ce pack',
    add: 'Ajouter ce pack',
    close: 'Fermer',
    loading: 'Chargement…',
  },
  nl: {
    back: '← Start',
    title: 'BricoPacks',
    sub: 'Al het materiaal voor een werf, samen en met korting.',
    popular: 'Populair',
    tools: 'gereedschap',
    perDay: '/ dag',
    instead: 'i.p.v.',
    save: 'Besparing',
    included: 'In dit pakket',
    add: 'Dit pakket toevoegen',
    close: 'Sluiten',
    loading: 'Laden…',
  },
  en: {
    back: '← Home',
    title: 'BricoPacks',
    sub: 'All the gear for a job, bundled at a lower price.',
    popular: 'Popular',
    tools: 'tools',
    perDay: '/ day',
    instead: 'instead of',
    save: 'You save',
    included: 'In this pack',
    add: 'Add this pack',
    close: 'Close',
    loading: 'Loading…',
  },
};

const img = (s?: string | null) => (s && s.length > 0 ? s : PLACEHOLDER_IMG);

export default function BornePacksPage() {
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = T[locale] ?? T.fr;
  const { addItem } = useCart();

  const [packs, setPacks] = useState<PackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<PackDetail | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ packs: PackRow[] }>(`/api/public/bricopacks?locale=${locale}`)
      .then((r) => setPacks(r.packs))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [locale]);

  async function openPack(slug: string) {
    try {
      const r = await api<{ pack: PackDetail }>(`/api/public/bricopacks/${slug}?locale=${locale}`);
      setOpen(r.pack);
    } catch {
      /* ignore */
    }
  }

  async function addPack() {
    if (!open) return;
    setBusy(true);
    try {
      await addItem(open.id, 1);
      router.push('/borne/catalogue?to=cart');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kioskm-shop">
      <div className="kioskm-shop__head">
        <button className="kioskm-back" onClick={() => router.push('/borne')}>
          {t.back}
        </button>
        <h1>{t.title}</h1>
        <p className="kioskm-sub">{t.sub}</p>
      </div>

      {loading ? (
        <p className="kioskm-sub">{t.loading}</p>
      ) : (
        <div className="kioskm-shop__grid">
          {packs.map((p) => (
            <button key={p.slug} className="kioskm-prod kioskm-prod--pack" onClick={() => openPack(p.slug)}>
              {p.popular && <span className="kioskm-prod__tag">{t.popular}</span>}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img(p.image)} alt="" className="kioskm-prod__img" />
              <span className="kioskm-prod__name">{p.name}</span>
              <span className="kioskm-prod__meta">
                {p.toolCount} {t.tools}
              </span>
              <span className="kioskm-prod__price">
                {formatEUR(p.dailyPrice)} {t.perDay}
                {p.separateTotal && p.separateTotal > p.dailyPrice && (
                  <s> {formatEUR(p.separateTotal)}</s>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="kioskm-modal" onClick={() => setOpen(null)}>
          <div className="kioskm-modal__box" onClick={(e) => e.stopPropagation()}>
            <button className="kioskm-modal__close" onClick={() => setOpen(null)} aria-label={t.close}>
              ✕
            </button>
            <div className="kioskm-modal__info kioskm-modal__info--full">
              <span className="kioskm-modal__brand">{t.title}</span>
              <h2>{open.name}</h2>
              {open.intro && <p className="kioskm-modal__desc">{open.intro}</p>}

              <div className="kioskm-modal__tiers">
                <div>
                  <span>{t.perDay.replace('/ ', '')}</span>
                  <strong>{formatEUR(open.dailyPrice)}</strong>
                </div>
                {open.separateTotal > open.dailyPrice && (
                  <div>
                    <span>{t.instead}</span>
                    <strong>
                      <s>{formatEUR(open.separateTotal)}</s>
                    </strong>
                  </div>
                )}
                {open.savingPerDay > 0 && (
                  <div>
                    <span>{t.save}</span>
                    <strong style={{ color: 'var(--ok, #1a7f37)' }}>
                      −{formatEUR(open.savingPerDay)}
                    </strong>
                  </div>
                )}
              </div>

              <h3 className="kioskm-modal__h3">{t.included}</h3>
              <ul className="kioskm-modal__packlist">
                {open.items.map((it) => (
                  <li key={it.slug}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img(it.image)} alt="" />
                    <span>
                      <strong>{it.name}</strong>
                      {it.why && <small>{it.why}</small>}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                className="btn btn-primary btn-lg btn-block"
                disabled={busy}
                onClick={addPack}
              >
                ＋ {t.add}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
