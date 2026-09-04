'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { formatEUR, type Locale } from '@bricoloc/shared';
import { api } from '@/lib/api';
import { useCart } from '@/lib/providers';
import { useRouter } from '@/i18n/navigation';
import { PLACEHOLDER_IMG } from '@/lib/placeholder';
import { defaultPeriod, toLocalInput, fromLocalInput } from '@/lib/dates';
import type { Category, ProductSummary, ProductDetail, RecommendationGroup } from '@/lib/types';

type Step = 'dates' | 'browse' | 'cart' | 'extras';

const T: Record<Locale, Record<string, string>> = {
  fr: {
    back: '← Accueil',
    datesTitle: 'Vos dates de location',
    datesSub: 'Une seule période pour toute la commande — on vérifie la disponibilité de chaque outil.',
    startLabel: 'Début',
    endLabel: 'Retour',
    datesCta: 'Voir les outils disponibles',
    search: 'Rechercher un outil…',
    all: 'Tout',
    available: 'Disponible',
    limited: 'Stock limité',
    unavailable: 'Indisponible',
    add: 'Ajouter',
    added: 'Dans le panier',
    perDay: '/ jour',
    perUnit: '/ unité',
    seeCart: 'Voir mon panier',
    cartTitle: 'Votre panier',
    empty: 'Votre panier est vide.',
    addMore: '＋ Ajouter d’autres outils',
    continue: 'Continuer',
    totalTVAC: 'Total TVAC',
    dayTotal: 'Sous-total / jour',
    deposit: 'Caution (empreinte)',
    extrasTitle: 'On complète ?',
    grpConsumable: 'Les consommables',
    grpAccessory: 'Les accessoires',
    grpPpe: 'La protection',
    noThanks: 'Non merci, continuer',
    toCheckout: 'Passer au paiement',
    close: 'Fermer',
    week: 'Semaine',
    day: 'Jour',
    month: 'Mois',
    qty: 'Quantité',
    modalAdd: 'Ajouter au panier',
    loading: 'Chargement…',
    noResult: 'Aucun outil ne correspond.',
  },
  nl: {
    back: '← Start',
    datesTitle: 'Uw huurperiode',
    datesSub: 'Eén periode voor de hele bestelling — we controleren de beschikbaarheid van elk stuk gereedschap.',
    startLabel: 'Start',
    endLabel: 'Terug',
    datesCta: 'Beschikbaar gereedschap tonen',
    search: 'Zoek gereedschap…',
    all: 'Alles',
    available: 'Beschikbaar',
    limited: 'Beperkte voorraad',
    unavailable: 'Niet beschikbaar',
    add: 'Toevoegen',
    added: 'In winkelmand',
    perDay: '/ dag',
    perUnit: '/ stuk',
    seeCart: 'Bekijk winkelmand',
    cartTitle: 'Uw winkelmand',
    empty: 'Uw winkelmand is leeg.',
    addMore: '＋ Meer gereedschap toevoegen',
    continue: 'Doorgaan',
    totalTVAC: 'Totaal incl. btw',
    dayTotal: 'Subtotaal / dag',
    deposit: 'Borg (reservering)',
    extrasTitle: 'Iets aanvullen?',
    grpConsumable: 'Verbruiksartikelen',
    grpAccessory: 'Accessoires',
    grpPpe: 'Bescherming',
    noThanks: 'Nee bedankt, doorgaan',
    toCheckout: 'Naar betaling',
    close: 'Sluiten',
    week: 'Week',
    day: 'Dag',
    month: 'Maand',
    qty: 'Aantal',
    modalAdd: 'In winkelmand',
    loading: 'Laden…',
    noResult: 'Geen gereedschap gevonden.',
  },
  en: {
    back: '← Home',
    datesTitle: 'Your rental dates',
    datesSub: 'One period for the whole order — we check every tool’s availability.',
    startLabel: 'Start',
    endLabel: 'Return',
    datesCta: 'Show available tools',
    search: 'Search a tool…',
    all: 'All',
    available: 'Available',
    limited: 'Low stock',
    unavailable: 'Unavailable',
    add: 'Add',
    added: 'In cart',
    perDay: '/ day',
    perUnit: '/ unit',
    seeCart: 'View my cart',
    cartTitle: 'Your cart',
    empty: 'Your cart is empty.',
    addMore: '＋ Add more tools',
    continue: 'Continue',
    totalTVAC: 'Total incl. VAT',
    dayTotal: 'Subtotal / day',
    deposit: 'Deposit (hold)',
    extrasTitle: 'Anything to add?',
    grpConsumable: 'Consumables',
    grpAccessory: 'Accessories',
    grpPpe: 'Protection',
    noThanks: 'No thanks, continue',
    toCheckout: 'Go to payment',
    close: 'Close',
    week: 'Week',
    day: 'Day',
    month: 'Month',
    qty: 'Quantity',
    modalAdd: 'Add to cart',
    loading: 'Loading…',
    noResult: 'No tool matches.',
  },
};

function img(src?: string | null) {
  return src && src.length > 0 ? src : PLACEHOLDER_IMG;
}

function ShopInner() {
  const router = useRouter();
  const params = useSearchParams();
  const locale = useLocale() as Locale;
  const t = T[locale] ?? T.fr;
  const { cart, addItem, setQty, removeItem, setPeriod, setFulfilment } = useCart();

  const wantCart = params.get('to') === 'cart';
  const hasPeriod = !!cart?.period;
  const [step, setStep] = useState<Step>(
    wantCart && hasPeriod ? 'cart' : hasPeriod ? 'browse' : 'dates',
  );

  const dp = defaultPeriod();
  const [start, setStart] = useState(toLocalInput(cart?.period?.start ?? dp.start));
  const [end, setEnd] = useState(toLocalInput(cart?.period?.end ?? dp.end));
  const [datesBusy, setDatesBusy] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState(params.get('category') ?? '');
  const [q, setQ] = useState(params.get('q') ?? '');
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [detailImg, setDetailImg] = useState(0);
  const [detailQty, setDetailQty] = useState(1);
  const [detailBusy, setDetailBusy] = useState(false);

  const [extrasIdx, setExtrasIdx] = useState(0);
  const [extraGroups, setExtraGroups] = useState<RecommendationGroup[]>([]);

  const inCartQty = useCallback(
    (id: string) => cart?.items.find((i) => i.productId === id)?.quantity ?? 0,
    [cart],
  );

  useEffect(() => {
    api<{ categories: Category[] }>(`/api/catalog/categories?locale=${locale}`)
      .then((r) => setCategories(r.categories))
      .catch(() => undefined);
  }, [locale]);

  const periodStart = cart?.period?.start ?? '';
  const periodEnd = cart?.period?.end ?? '';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const sp = new URLSearchParams({ locale, sort: 'name', pageSize: '60' });
    if (category) sp.set('category', category);
    if (q.trim()) sp.set('q', q.trim());
    if (periodStart && periodEnd) {
      sp.set('start', periodStart);
      sp.set('end', periodEnd);
    }
    const id = setTimeout(() => {
      api<{ products: ProductSummary[] }>(`/api/catalog/products?${sp}`)
        .then((r) => {
          if (!cancelled) setProducts(r.products);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [locale, category, q, periodStart, periodEnd]);

  async function saveDates() {
    setDatesBusy(true);
    try {
      await setPeriod({ start: fromLocalInput(start), end: fromLocalInput(end) });
      await setFulfilment({ mode: 'PICKUP' });
      setStep(wantCart ? 'cart' : 'browse');
    } catch {
      /* garde l'ecran dates */
    } finally {
      setDatesBusy(false);
    }
  }

  async function openDetail(slug: string) {
    setDetailImg(0);
    setDetailQty(1);
    try {
      const r = await api<{ product: ProductDetail }>(
        `/api/catalog/products/${slug}?locale=${locale}`,
      );
      setDetail(r.product);
    } catch {
      /* ignore */
    }
  }

  async function quickAdd(id: string) {
    setBusyId(id);
    try {
      await addItem(id, 1);
    } finally {
      setBusyId(null);
    }
  }

  async function addFromModal() {
    if (!detail) return;
    setDetailBusy(true);
    try {
      const current = inCartQty(detail.id);
      if (current > 0) await setQty(detail.id, current + detailQty);
      else await addItem(detail.id, detailQty);
      setDetail(null);
    } finally {
      setDetailBusy(false);
    }
  }

  // Recommandations = uniquement les liens métier réels de la machine
  // (disqueuse → disques, perfo → mèches, ponceuse → abrasifs…). Pas de
  // suggestions génériques : si rien de pertinent, on passe directement au paiement.
  const goExtras = () => {
    const groups = cart?.recommendations ?? [];
    if (groups.length === 0) {
      router.push('/commande');
      return;
    }
    setExtraGroups(groups);
    setExtrasIdx(0);
    setStep('extras');
  };
  const nextExtra = () => {
    if (extrasIdx + 1 < extraGroups.length) setExtrasIdx((i) => i + 1);
    else router.push('/commande');
  };

  const count = cart?.itemCount ?? 0;
  const totals = cart?.quote?.totals;
  const dailySubtotal = (cart?.items ?? []).reduce(
    (s, i) => s + i.dailyPrice * i.quantity,
    0,
  );

  /* ------------------------------- DATES ------------------------------ */
  if (step === 'dates') {
    return (
      <div className="kioskm-shop">
        <div className="kioskm-shop__head">
          <button className="kioskm-back" onClick={() => router.push('/borne')}>
            {t.back}
          </button>
          <h1>{t.datesTitle}</h1>
          <p className="kioskm-sub">{t.datesSub}</p>
        </div>
        <div className="kioskm-dates">
          <label className="kioskm-dates__f">
            <span>{t.startLabel}</span>
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="kioskm-dates__f">
            <span>{t.endLabel}</span>
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <div className="kioskm-shop__foot">
          <button
            className="btn btn-primary btn-lg"
            disabled={datesBusy || !start || !end || end <= start}
            onClick={saveDates}
          >
            {datesBusy ? '…' : t.datesCta}
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------ EXTRAS ------------------------------ */
  if (step === 'extras') {
    const group = extraGroups[Math.min(extrasIdx, extraGroups.length - 1)];
    return (
      <div className="kioskm-shop">
        <div className="kioskm-shop__head">
          <button className="kioskm-back" onClick={() => setStep('cart')}>
            ← {t.cartTitle}
          </button>
          <h1>{t.extrasTitle}</h1>
        </div>
        {group && (
          <>
            <p className="kioskm-shop__grouplabel">
              {group.label}
              {extraGroups.length > 1 && (
                <span> · {extrasIdx + 1}/{extraGroups.length}</span>
              )}
            </p>
            <div className="kioskm-shop__grid">
              {group.products.map((p) => {
                const has = inCartQty(p.id);
                return (
                  <div key={p.id} className="kioskm-prod">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img(p.image)} alt="" className="kioskm-prod__img" />
                    <span className="kioskm-prod__name">{p.name}</span>
                    <span className="kioskm-prod__price">
                      {formatEUR(p.dailyPrice)} {p.isConsumable ? t.perUnit : t.perDay}
                    </span>
                    <button
                      className={`btn ${has ? 'btn-outline' : 'btn-primary'} btn-block`}
                      disabled={busyId === p.id}
                      onClick={() => quickAdd(p.id)}
                    >
                      {has ? `✓ ${t.added} (${has})` : `＋ ${t.add}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <div className="kioskm-shop__foot">
          <button className="btn btn-ghost btn-lg" onClick={nextExtra}>
            {t.noThanks}
          </button>
          <button className="btn btn-primary btn-lg" onClick={() => router.push('/commande')}>
            {t.toCheckout}
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------- CART ------------------------------- */
  if (step === 'cart') {
    return (
      <div className="kioskm-shop">
        <div className="kioskm-shop__head">
          <button className="kioskm-back" onClick={() => setStep('browse')}>
            {t.addMore}
          </button>
          <h1>{t.cartTitle}</h1>
        </div>

        {!cart || cart.items.length === 0 ? (
          <p className="kioskm-sub">{t.empty}</p>
        ) : (
          <>
            <ul className="kioskm-shop__lines">
              {cart.items.map((i) => (
                <li key={i.id} className="kioskm-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(i.image)} alt="" />
                  <div className="kioskm-line__body">
                    <span className="kioskm-line__name">{i.name}</span>
                    <span className="kioskm-line__price">
                      {formatEUR(i.dailyPrice)} {i.isConsumable ? t.perUnit : t.perDay}
                    </span>
                  </div>
                  <div className="kioskm-qty">
                    <button
                      onClick={() =>
                        i.quantity <= 1
                          ? removeItem(i.productId)
                          : setQty(i.productId, i.quantity - 1)
                      }
                      aria-label="−"
                    >
                      −
                    </button>
                    <span>{i.quantity}</span>
                    <button onClick={() => setQty(i.productId, i.quantity + 1)} aria-label="+">
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="kioskm-shop__totals">
              {totals ? (
                <>
                  <div>
                    <span>{t.totalTVAC}</span>
                    <strong>{formatEUR(totals.totalTVAC)}</strong>
                  </div>
                  <div className="muted">
                    <span>{t.deposit}</span>
                    <span>{formatEUR(totals.depositsTotal)}</span>
                  </div>
                </>
              ) : (
                <div>
                  <span>{t.dayTotal}</span>
                  <strong>
                    {formatEUR(dailySubtotal)} <small>{t.perDay}</small>
                  </strong>
                </div>
              )}
            </div>

            <div className="kioskm-shop__foot">
              <button className="btn btn-ghost btn-lg" onClick={() => setStep('browse')}>
                {t.addMore}
              </button>
              <button
                className="btn btn-primary btn-lg"
                disabled={cart.hasBlockingIssue}
                onClick={goExtras}
              >
                {t.continue}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  /* ------------------------------ BROWSE ------------------------------ */
  const periodLabel =
    periodStart && periodEnd
      ? `${new Date(periodStart).toLocaleDateString(locale)} → ${new Date(periodEnd).toLocaleDateString(locale)}`
      : '';

  return (
    <div className="kioskm-shop">
      <div className="kioskm-shop__head">
        <button className="kioskm-back" onClick={() => router.push('/borne')}>
          {t.back}
        </button>
        {periodLabel && (
          <button className="kioskm-shop__period" onClick={() => setStep('dates')}>
            📅 {periodLabel} <span>✎</span>
          </button>
        )}
      </div>

      <input
        className="kioskm-shop__search"
        placeholder={t.search}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="kioskm-shop__cats">
        <button
          className={`chip${!category ? ' active' : ''}`}
          onClick={() => setCategory('')}
        >
          {t.all}
        </button>
        {categories.map((c) => (
          <button
            key={c.slug}
            className={`chip${category === c.slug ? ' active' : ''}`}
            onClick={() => setCategory(c.slug)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="kioskm-sub">{t.loading}</p>
      ) : products.length === 0 ? (
        <p className="kioskm-sub">{t.noResult}</p>
      ) : (
        <div className="kioskm-shop__grid">
          {products.map((p) => {
            const has = inCartQty(p.id);
            const st = p.availability?.status;
            const blocked = st === 'UNAVAILABLE';
            return (
              <div key={p.id} className="kioskm-prod">
                <button className="kioskm-prod__open" onClick={() => openDetail(p.slug)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(p.image)} alt="" className="kioskm-prod__img" />
                  {p.brand && <span className="kioskm-prod__brand">{p.brand}</span>}
                  <span className="kioskm-prod__name">{p.name}</span>
                  <span className="kioskm-prod__price">
                    {formatEUR(p.dailyPrice)} {p.isConsumable ? t.perUnit : t.perDay}
                  </span>
                  {st && (
                    <span
                      className={`kioskm-prod__dispo kioskm-prod__dispo--${
                        st === 'AVAILABLE' ? 'ok' : st === 'PARTIAL' ? 'warn' : 'off'
                      }`}
                    >
                      {st === 'AVAILABLE'
                        ? `✔ ${t.available}`
                        : st === 'PARTIAL'
                          ? t.limited
                          : t.unavailable}
                    </span>
                  )}
                </button>
                {has > 0 ? (
                  <div className="kioskm-qty kioskm-qty--block">
                    <button onClick={() => setQty(p.id, has - 1)} aria-label="−">
                      −
                    </button>
                    <span>{has}</span>
                    <button onClick={() => setQty(p.id, has + 1)} aria-label="+">
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-primary btn-block"
                    disabled={blocked || busyId === p.id}
                    onClick={() => quickAdd(p.id)}
                  >
                    ＋ {t.add}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {count > 0 && (
        <button className="kioskm-shop__bar" onClick={() => setStep('cart')}>
          <span className="kioskm-shop__bar-c">{count}</span>
          <span>{t.seeCart}</span>
          <strong>
            {formatEUR(totals?.totalTVAC ?? dailySubtotal)}
            {!totals && <small> {t.perDay}</small>}
          </strong>
        </button>
      )}

      {/* ----------------------------- MODAL ----------------------------- */}
      {detail && (
        <div className="kioskm-modal" onClick={() => setDetail(null)}>
          <div className="kioskm-modal__box" onClick={(e) => e.stopPropagation()}>
            <button
              className="kioskm-modal__close"
              onClick={() => setDetail(null)}
              aria-label={t.close}
            >
              ✕
            </button>
            <div className="kioskm-modal__grid">
              <div className="kioskm-modal__media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img(detail.images?.[detailImg] ?? detail.image)}
                  alt={detail.name}
                />
                {(detail.images?.length ?? 0) > 1 && (
                  <div className="kioskm-modal__thumbs">
                    {detail.images.map((src, i) => (
                      <button
                        key={i}
                        className={i === detailImg ? 'is-active' : ''}
                        onClick={() => setDetailImg(i)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img(src)} alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="kioskm-modal__info">
                {detail.brand && <span className="kioskm-modal__brand">{detail.brand}</span>}
                <h2>{detail.name}</h2>

                <div className="kioskm-modal__tiers">
                  <div>
                    <span>{t.day}</span>
                    <strong>{formatEUR(detail.dailyPrice)}</strong>
                  </div>
                  <div>
                    <span>{t.week}</span>
                    <strong>{formatEUR(detail.weekPrice ?? detail.dailyPrice * 4)}</strong>
                  </div>
                  <div>
                    <span>{t.month}</span>
                    <strong>{formatEUR(detail.monthPrice ?? detail.dailyPrice * 12)}</strong>
                  </div>
                </div>
                {detail.deposit > 0 && (
                  <p className="kioskm-sub" style={{ margin: 0 }}>
                    {t.deposit} : {formatEUR(detail.deposit)}
                  </p>
                )}
                {(detail.shortDescription || detail.description) && (
                  <p className="kioskm-modal__desc">
                    {detail.shortDescription || detail.description}
                  </p>
                )}

                <div className="kioskm-modal__buy">
                  <div className="kioskm-qty">
                    <button
                      onClick={() => setDetailQty((n) => Math.max(1, n - 1))}
                      aria-label="−"
                    >
                      −
                    </button>
                    <span>{detailQty}</span>
                    <button onClick={() => setDetailQty((n) => n + 1)} aria-label="+">
                      +
                    </button>
                  </div>
                  <button
                    className="btn btn-primary btn-lg"
                    disabled={detailBusy || detail.availability?.status === 'UNAVAILABLE'}
                    onClick={addFromModal}
                  >
                    ＋ {t.modalAdd}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BorneShopPage() {
  return (
    <Suspense fallback={<div className="kioskm-shop" />}>
      <ShopInner />
    </Suspense>
  );
}
