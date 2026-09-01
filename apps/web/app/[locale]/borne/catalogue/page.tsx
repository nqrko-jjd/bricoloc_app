'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { formatEUR, formatDateTimeBE } from '@bricoloc/shared';
import { api } from '@/lib/api';
import { ensureKioskCart, kioskApi, kioskCartKey, resetKioskSession } from '@/lib/kiosk';
import { defaultPeriod, toLocalInput, fromLocalInput } from '@/lib/dates';
import { OnScreenKeyboard } from '@/components/OnScreenKeyboard';
import type { Cart, ProductSummary } from '@/lib/types';

type Step = 'dates' | 'browse' | 'cart' | 'contact' | 'pay' | 'done';

function KioskCatalogue() {
  const router = useRouter();
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

  return (
    <div className="kiosk-body" style={{ justifyContent: 'flex-start', paddingTop: 30 }}>
      <div className="spread" style={{ width: '100%', maxWidth: 960 }}>
        <button className="btn btn-ghost" onClick={() => router.push('/borne')}>
          ← Accueil
        </button>
        {cart && step !== 'dates' && (
          <button
            className="btn"
            style={{ background: '#fff', color: 'var(--loc)' }}
            onClick={() => setStep('cart')}
          >
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
        <div style={{ maxWidth: 640, width: '100%', marginTop: 30 }}>
          <h1>Vos dates de location</h1>
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
        <div style={{ maxWidth: 960, width: '100%', marginTop: 20 }}>
          <input
            placeholder="Rechercher un outil…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: '100%', padding: 14, fontSize: '1.1rem', borderRadius: 10, border: 'none' }}
          />
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', marginTop: 16 }}
          >
            {products.map((p) => {
              const inCart = cart?.items.find((i) => i.productId === p.id);
              const dispo = p.availability?.status;
              return (
                <div key={p.id} className="card card-body" style={{ color: 'var(--dark-gray)' }}>
                  <strong>{p.name}</strong>
                  <div className="small muted">
                    {formatEUR(p.dailyPrice)} / {p.isConsumable ? 'unité' : 'jour'}
                  </div>
                  <div className="small" style={{ margin: '6px 0' }}>
                    {dispo === 'AVAILABLE' ? (
                      <span style={{ color: 'var(--ok)' }}>✔ Disponible</span>
                    ) : dispo === 'PARTIAL' ? (
                      <span style={{ color: 'var(--warn)' }}>Stock limité</span>
                    ) : (
                      <span style={{ color: 'var(--err)' }}>Indisponible</span>
                    )}
                  </div>
                  {inCart ? (
                    <div className="row">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setQty(p.id, Math.max(0, inCart.quantity - 1))}
                      >
                        −
                      </button>
                      <span>{inCart.quantity}</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setQty(p.id, inCart.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm btn-block"
                      disabled={dispo === 'UNAVAILABLE' || dispo === 'NEARBY'}
                      onClick={() => add(p.id)}
                    >
                      Ajouter
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
        <div style={{ maxWidth: 720, width: '100%', marginTop: 20, color: 'var(--dark-gray)' }}>
          <h1 style={{ color: '#fff' }}>Votre panier</h1>
          <div className="card card-pad">
            {cart.items.map((i) => (
              <div key={i.id} className="spread" style={{ padding: '8px 0' }}>
                <span>
                  {i.quantity}× {i.name}
                </span>
                <span>{formatEUR(i.dailyPrice * i.quantity)}</span>
              </div>
            ))}
            {cart.quote && (
              <>
                <div className="line total">
                  <span>Total TVAC</span>
                  <span>{formatEUR(cart.quote.totals.totalTVAC)}</span>
                </div>
                <div className="line deposit">
                  <span>Caution</span>
                  <span>{formatEUR(cart.quote.totals.depositsTotal)}</span>
                </div>
              </>
            )}
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={() => setStep('browse')}>
              Ajouter d&apos;autres outils
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
        <div style={{ maxWidth: 760, width: '100%', marginTop: 16 }}>
          <h1>Vos coordonnées</h1>
          <div className="pill-row" style={{ justifyContent: 'center', marginBottom: 10 }}>
            {(['firstName', 'lastName', 'email', 'phone'] as const).map((k) => (
              <button
                key={k}
                className={`chip${field === k ? ' active' : ''}`}
                onClick={() => setField(k)}
              >
                {k === 'firstName'
                  ? `Prénom${contact.firstName ? ' ✔' : ''}`
                  : k === 'lastName'
                    ? `Nom${contact.lastName ? ' ✔' : ''}`
                    : k === 'email'
                      ? `E-mail${contact.email ? ' ✔' : ''}`
                      : `Téléphone${contact.phone ? ' ✔' : ''}`}
              </button>
            ))}
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
          <button
            className="btn btn-primary btn-lg"
            style={{ marginTop: 16 }}
            disabled={
              !contact.firstName || !contact.lastName || !contact.email || !contact.phone
            }
            onClick={() => setStep('pay')}
          >
            Continuer vers le paiement
          </button>
        </div>
      )}

      {step === 'pay' && cart && (
        <div style={{ maxWidth: 560, width: '100%', marginTop: 30, textAlign: 'center' }}>
          <h1>Paiement — démonstration</h1>
          <p style={{ fontSize: '2rem', fontWeight: 800 }}>
            {formatEUR(cart.quote?.totals.amountDue ?? 0)}
          </p>
          <p style={{ opacity: 0.8 }}>
            {formatDateTimeBE(fromLocalInput(start))} → {formatDateTimeBE(fromLocalInput(end))}
          </p>
          <button className="btn btn-primary btn-lg" onClick={pay} disabled={busy}>
            {busy ? 'Traitement…' : 'Payer (mode test)'}
          </button>
          <br />
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setStep('cart')}>
            Retour
          </button>
        </div>
      )}

      {step === 'done' && result && (
        <div style={{ maxWidth: 560, width: '100%', marginTop: 30, textAlign: 'center' }}>
          <h1>Réservation confirmée</h1>
          <p style={{ fontSize: '1.6rem', fontWeight: 800 }}>{result.number}</p>
          <div className="qr-box">
            <img src={result.qrDataUrl} alt="QR" />
          </div>
          <p style={{ opacity: 0.85 }}>
            Présentez ce QR code au comptoir. Un e-mail de confirmation vous a été envoyé (démo).
          </p>
          <button
            className="btn btn-primary btn-lg"
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
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="kiosk-body">Chargement…</div>}>
      <KioskCatalogue />
    </Suspense>
  );
}
