'use client';
import { Suspense, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useSearchParams, useParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { formatEUR, formatDateTimeBE, SUPPORTED_LOCALES, type Locale } from '@bricoloc/shared';
import { KioskFrame } from '@/components/kiosk/KioskFrame';
import { api } from '@/lib/api';
import { ensureKioskCart, kioskApi, kioskCartKey, resetKioskSession } from '@/lib/kiosk';
import { defaultPeriod, toLocalInput, fromLocalInput } from '@/lib/dates';
import { OnScreenKeyboard } from '@/components/OnScreenKeyboard';
import { PLACEHOLDER_IMG } from '@/lib/placeholder';
import type { Cart, ProductSummary, ProductDetail } from '@/lib/types';

type Step = 'dates' | 'browse' | 'cart' | 'contact' | 'pay' | 'done';

const STEP_NUM: Record<Step, number> = {
  dates: 3,
  browse: 4,
  cart: 5,
  contact: 6,
  pay: 7,
  done: 8,
};

function KioskCatalogue() {
  const router = useRouter();
  const pathname = usePathname();
  const routeParams = useParams();
  const locale = useLocale() as Locale;
  const params = useSearchParams();
  const [step, setStep] = useState<Step>('dates');
  const [cart, setCart] = useState<Cart | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const d = defaultPeriod();
  const [start, setStart] = useState(toLocalInput(d.start));
  const [end, setEnd] = useState(toLocalInput(d.end));

  const [contact, setContact] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [field, setField] = useState<keyof typeof contact>('firstName');
  const [result, setResult] = useState<{ number: string; qrDataUrl: string } | null>(null);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [detailImg, setDetailImg] = useState(0);

  async function openDetail(slug: string) {
    setDetailImg(0);
    const sp = `?start=${fromLocalInput(start)}&end=${fromLocalInput(end)}&locale=${locale}`;
    const r = await api<{ product: ProductDetail }>(`/api/catalog/products/${slug}${sp}`);
    setDetail(r.product);
  }

  async function refreshCart() {
    const key = kioskCartKey();
    if (!key) return;
    const c = await api<Cart>('/api/cart', { cartKey: key });
    setCart(c);
  }

  async function confirmDates() {
    setBusy(true);
    setErr('');
    try {
      await ensureKioskCart();
      await kioskApi('/api/cart/period', {
        method: 'PUT',
        body: { period: { start: fromLocalInput(start), end: fromLocalInput(end) } },
      });
      await kioskApi('/api/cart/fulfilment', { method: 'PUT', body: { mode: 'PICKUP' } });
      await loadProducts();
      await refreshCart();
      setStep('browse');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  async function loadProducts() {
    const sp = new URLSearchParams({
      start: fromLocalInput(start),
      end: fromLocalInput(end),
      pageSize: '30',
      sort: 'name',
      locale,
    });
    if (q) sp.set('q', q);
    if (params.get('available')) sp.set('onlyAvailable', 'true');
    const r = await api<{ products: ProductSummary[] }>(`/api/catalog/products?${sp}`);
    setProducts(r.products);
  }

  useEffect(() => {
    if (step === 'browse') loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function add(id: string) {
    await kioskApi('/api/cart/items', { method: 'POST', body: { productId: id, quantity: 1 } });
    await refreshCart();
  }
  async function setQty(id: string, qty: number) {
    await kioskApi(`/api/cart/items/${id}`, { method: 'PATCH', body: { quantity: qty } });
    await refreshCart();
  }

  async function pay() {
    setBusy(true);
    setErr('');
    try {
      const checkout = await kioskApi<{ reservation: { id: string } }>('/api/checkout', {
        method: 'POST',
        body: {
          period: { start: fromLocalInput(start), end: fromLocalInput(end) },
          fulfilment: { mode: 'PICKUP' },
          contact,
          acceptTerms: true,
          channel: 'KIOSK',
        },
      });
      const done = await api<{ number: string; qrDataUrl: string }>('/api/checkout/pay', {
        method: 'POST',
        body: { reservationId: checkout.reservation.id, outcome: 'success' },
      });
      setResult(done);
      setStep('done');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Paiement refusé');
    } finally {
      setBusy(false);
    }
  }

  const switchLocale = (l: Locale) =>
    // @ts-expect-error params dynamiques transmis tels quels
    router.replace({ pathname, params: routeParams }, { locale: l });

  return (
    <KioskFrame
      step={STEP_NUM[step]}
      locale={locale}
      locales={SUPPORTED_LOCALES}
      onLocale={switchLocale}
      cartCount={cart?.itemCount ?? 0}
    >
      <div className="kiosk-flow">
      <div className="spread" style={{ width: '100%' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/borne')}>
          ← Accueil
        </button>
        {cart && step !== 'dates' && step !== 'cart' && (
          <button className="btn btn-sm" onClick={() => setStep('cart')}>
            🛒 {cart.itemCount} article(s)
          </button>
        )}
      </div>

      {err && (
        <div className="alert alert-err" style={{ maxWidth: 960, width: '100%', marginTop: 12 }}>
          {err}
        </div>
      )}

      {step === 'dates' && (
        <div className="kiosk-checkout">
          <span className="eyebrow">— Étape 1</span>
          <h1>
            Vos dates <i>de location</i>
          </h1>
          <p className="kiosk-sub">Une seule fois, pour tout le matériel de la commande.</p>
          <div className="datepicker-card">
            <div className="field">
              <label>Début</label>
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Retour</label>
              <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-lg" onClick={confirmDates} disabled={busy}>
              Voir le matériel disponible
            </button>
          </div>
        </div>
      )}

      {step === 'browse' && (
        <div className="kiosk-checkout kiosk-checkout--wide">
          <input
            className="kiosk-browsesearch"
            placeholder="Rechercher un outil…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="kiosk-cat-grid">
            {products.map((p) => {
              const inCart = cart?.items.find((i) => i.productId === p.id);
              const dispo = p.availability?.status;
              return (
                <div key={p.id} className="kiosk-prod">
                  <button className="kiosk-prod__open" onClick={() => openDetail(p.slug)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image || PLACEHOLDER_IMG}
                      alt=""
                      onError={(e) => ((e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMG)}
                    />
                    <span className="kiosk-prod__name">{p.name}</span>
                    <span className="kiosk-prod__price">
                      {formatEUR(p.dailyPrice)} / {p.isConsumable ? 'unité' : 'jour'}
                    </span>
                    <span className="kiosk-prod__dispo">
                      {dispo === 'AVAILABLE' ? (
                        <span style={{ color: 'var(--ok)' }}>✔ Disponible</span>
                      ) : dispo === 'PARTIAL' ? (
                        <span style={{ color: 'var(--warn)' }}>Stock limité</span>
                      ) : (
                        <span style={{ color: 'var(--err)' }}>Indisponible</span>
                      )}
                    </span>
                  </button>
                  {inCart ? (
                    <div className="kiosk-prod__qty">
                      <button onClick={() => setQty(p.id, Math.max(0, inCart.quantity - 1))}>−</button>
                      <span>{inCart.quantity}</span>
                      <button onClick={() => setQty(p.id, inCart.quantity + 1)}>+</button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary btn-block"
                      disabled={dispo === 'UNAVAILABLE' || dispo === 'NEARBY'}
                      onClick={() => add(p.id)}
                    >
                      + Ajouter
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            className="btn btn-primary btn-lg"
            style={{ marginTop: 20 }}
            disabled={!cart || cart.itemCount === 0}
            onClick={() => setStep('cart')}
          >
            Voir mon panier ({cart?.itemCount ?? 0})
          </button>
        </div>
      )}

      {step === 'cart' && cart && (
        <div className="kiosk-checkout">
          <h1>Votre panier</h1>
          <ul className="kiosk-cartlist">
            {cart.items.map((i) => (
              <li key={i.id}>
                <span className="kiosk-cartlist__q">{i.quantity}×</span>
                <span className="kiosk-cartlist__n">{i.name}</span>
                <span className="kiosk-cartlist__p">{formatEUR(i.dailyPrice * i.quantity)}</span>
              </li>
            ))}
          </ul>
          {cart.quote && (
            <div className="kiosk-totals">
              <div>
                <span>Total TVAC</span>
                <strong>{formatEUR(cart.quote.totals.totalTVAC)}</strong>
              </div>
              <div className="kiosk-totals__dep">
                <span>Caution (empreinte bancaire)</span>
                <span>{formatEUR(cart.quote.totals.depositsTotal)}</span>
              </div>
            </div>
          )}
          <div className="kiosk-actions">
            <button className="btn btn-ghost" onClick={() => setStep('browse')}>
              ← Ajouter d&apos;autres outils
            </button>
            <button
              className="btn btn-primary btn-lg"
              disabled={cart.hasBlockingIssue}
              onClick={() => setStep('contact')}
            >
              Continuer
            </button>
          </div>
        </div>
      )}

      {step === 'contact' && (
        <div className="kiosk-checkout">
          <h1>Vos coordonnées</h1>
          <p className="kiosk-sub">Touchez un champ, puis saisissez-le au clavier.</p>
          <div className="kiosk-fields">
            {(['firstName', 'lastName', 'email', 'phone'] as const).map((k) => {
              const label = { firstName: 'Prénom', lastName: 'Nom', email: 'E-mail', phone: 'Téléphone' }[k];
              return (
                <button
                  key={k}
                  className={`kiosk-fieldchip${field === k ? ' is-active' : ''}${contact[k] ? ' is-filled' : ''}`}
                  onClick={() => setField(k)}
                >
                  <small>{label}</small>
                  <span>{contact[k] || '…'}</span>
                </button>
              );
            })}
          </div>
          <OnScreenKeyboard
            value={contact[field]}
            onChange={(v) => setContact({ ...contact, [field]: v })}
            onEnter={() => {
              const order: (keyof typeof contact)[] = ['firstName', 'lastName', 'email', 'phone'];
              const idx = order.indexOf(field);
              if (idx < order.length - 1) setField(order[idx + 1]!);
            }}
          />
          <div className="kiosk-actions">
            <button className="btn btn-ghost" onClick={() => setStep('cart')}>
              ← Retour
            </button>
            <button
              className="btn btn-primary btn-lg"
              disabled={!contact.firstName || !contact.lastName || !contact.email || !contact.phone}
              onClick={() => setStep('pay')}
            >
              Continuer vers le paiement
            </button>
          </div>
        </div>
      )}

      {step === 'pay' && cart && (
        <div className="kiosk-checkout kiosk-checkout--center">
          <span className="eyebrow">— Paiement · environnement de démonstration</span>
          <h1>À régler</h1>
          <p className="kiosk-amount">{formatEUR(cart.quote?.totals.amountDue ?? 0)}</p>
          <p className="kiosk-sub">
            {formatDateTimeBE(fromLocalInput(start))} → {formatDateTimeBE(fromLocalInput(end))}
          </p>
          <div className="kiosk-paymethods" aria-hidden>
            <span>💳 Carte</span>
            <span>Bancontact</span>
            <span>Espèces au comptoir</span>
          </div>
          <button className="btn btn-primary btn-lg btn-block" onClick={pay} disabled={busy}>
            {busy ? 'Traitement…' : 'Payer (mode test)'}
          </button>
          <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => setStep('contact')}>
            ← Retour
          </button>
        </div>
      )}

      {detail && (
        <div className="kiosk-modal" onClick={() => setDetail(null)}>
          <div className="kiosk-modal__box" onClick={(e) => e.stopPropagation()}>
            <button className="kiosk-modal__close" onClick={() => setDetail(null)} aria-label="Fermer">
              ✕
            </button>
            <div className="kiosk-modal__grid">
              <div className="kiosk-modal__media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={detail.images?.[detailImg] || detail.image || PLACEHOLDER_IMG}
                  alt={detail.name}
                  onError={(e) => ((e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMG)}
                />
                {(detail.images?.length ?? 0) > 1 && (
                  <div className="kiosk-modal__thumbs">
                    {detail.images.map((src, i) => (
                      <button
                        key={i}
                        className={i === detailImg ? 'is-active' : ''}
                        onClick={() => setDetailImg(i)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="kiosk-modal__info">
                {detail.brand && <span className="eyebrow">{detail.brand}</span>}
                <h2>{detail.name}</h2>

                <div className="kiosk-modal__tiers">
                  <div>
                    <span>Jour</span>
                    <strong>{formatEUR(detail.dailyPrice)}</strong>
                  </div>
                  <div>
                    <span>Semaine</span>
                    <strong>{formatEUR(detail.weekPrice ?? detail.dailyPrice * 4)}</strong>
                  </div>
                  <div>
                    <span>Mois</span>
                    <strong>{formatEUR(detail.monthPrice ?? detail.dailyPrice * 12)}</strong>
                  </div>
                </div>
                {detail.deposit > 0 && (
                  <p className="small muted">Caution : {formatEUR(detail.deposit)}</p>
                )}

                {detail.description && <p>{detail.description}</p>}

                {detail.recommendedUses?.length > 0 && (
                  <>
                    <h3>Utilisations conseillées</h3>
                    <ul>
                      {detail.recommendedUses.map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ul>
                  </>
                )}

                {Object.keys(detail.specs ?? {}).length > 0 && (
                  <>
                    <h3>Caractéristiques</h3>
                    <table className="table">
                      <tbody>
                        {Object.entries(detail.specs).map(([k, v]) => (
                          <tr key={k}>
                            <th>{k}</th>
                            <td>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                <button
                  className="btn btn-primary btn-lg btn-block"
                  style={{ marginTop: 16 }}
                  disabled={detail.availability?.status === 'UNAVAILABLE'}
                  onClick={async () => {
                    await add(detail.id);
                    setDetail(null);
                  }}
                >
                  + Ajouter au panier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="kiosk-checkout kiosk-checkout--center">
          <span className="kiosk-check" aria-hidden>
            ✓
          </span>
          <h1>
            Réservation <i>confirmée</i>
          </h1>
          <p className="kiosk-resnum">{result.number}</p>
          <div className="qr-box">
            <img src={result.qrDataUrl} alt="QR" />
          </div>
          <p className="kiosk-sub">
            Présentez ce QR code au comptoir. Un e-mail de confirmation vous a été envoyé (démo).
          </p>
          <button
            className="btn btn-primary btn-lg btn-block"
            onClick={() => {
              resetKioskSession();
              router.push('/borne');
            }}
          >
            Terminer
          </button>
        </div>
      )}
      </div>
    </KioskFrame>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="kiosk-body">Chargement…</div>}>
      <KioskCatalogue />
    </Suspense>
  );
}
