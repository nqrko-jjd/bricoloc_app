'use client';
import { Link } from '@/i18n/navigation';
import { useEffect, useMemo, useState } from 'react';
import { formatEUR, formatDateTimeBE } from '@bricoloc/shared';
import { api, clientApi } from '@/lib/api';
import { useCart, useSession } from '@/lib/providers';
import { CartSummary } from '@/components/CartSummary';
import { Steps } from '@/components/Steps';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { fromLocalInput, toLocalInput, defaultPeriod } from '@/lib/dates';

type Phase = 'dates' | 'fulfil' | 'account' | 'review' | 'pay' | 'done';

export default function CommandePage() {
  const { cart, setPeriod, setFulfilment, reload } = useCart();
  const { user, login, setToken, refresh } = useSession();

  const [phase, setPhase] = useState<Phase>('dates');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const d = defaultPeriod();
  const [start, setStart] = useState(toLocalInput(cart?.period?.start ?? d.start));
  const [end, setEnd] = useState(toLocalInput(cart?.period?.end ?? d.end));

  const [mode, setMode] = useState<'PICKUP' | 'DELIVERY'>(
    (cart?.fulfilmentMode as 'PICKUP' | 'DELIVERY') ?? 'PICKUP',
  );
  const [addr, setAddr] = useState({
    line1: '',
    postalCode: '',
    city: '',
    isConstructionSite: false,
  });
  const [slot, setSlot] = useState('Matin (8h-12h)');
  const [delivQuote, setDelivQuote] = useState<{
    served: boolean;
    distanceKm: number;
    feeHT: number;
    free: boolean;
    geocoded: boolean;
  } | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [authMode, setAuthMode] = useState<'login' | 'create' | 'guest'>('create');
  const [contact, setContact] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
  });
  const [password, setPassword] = useState('');
  const [accept, setAccept] = useState(false);

  const [result, setResult] = useState<{
    number: string;
    qrDataUrl: string;
    invoiceNumber: string;
    fulfilment: { mode: string; slot: string | null };
  } | null>(null);

  const canReview = useMemo(() => {
    if (!cart?.period) return false;
    if (mode === 'DELIVERY' && (!addr.line1 || !addr.postalCode || !addr.city)) return false;
    if (!user) {
      if (!contact.firstName || !contact.lastName || !contact.email || !contact.phone) return false;
      if (authMode === 'create' && password.length < 8) return false;
    }
    return true;
  }, [cart?.period, mode, addr, user, contact, authMode, password]);

  if (phase === 'done' && result) {
    return (
      <div className="section container">
        <h1>Commande</h1>
        <Steps current={5} />
        <div className="card card-pad stack center" style={{ alignItems: 'center', maxWidth: 520, margin: '0 auto' }}>
          <h2>Réservation confirmée 🎉</h2>
          <p className="price">{result.number}</p>
          <div className="qr-box">
            <img src={result.qrDataUrl} alt="QR code de la réservation" />
          </div>
          <p className="muted small">
            Présentez ce QR code au comptoir BRICOLOC
            {result.fulfilment.mode === 'DELIVERY' ? ' ou au livreur' : ''}.
          </p>
          <p className="small">Facture : {result.invoiceNumber}</p>
          <div className="row">
            <Link href="/compte" className="btn btn-primary">
              Voir mes réservations
            </Link>
            <Link href="/catalogue" className="btn btn-ghost">
              Nouvelle location
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="section container center">
        <h1>Panier vide</h1>
        <Link href="/catalogue" className="btn btn-primary">
          Voir le catalogue
        </Link>
      </div>
    );
  }

  async function saveDates() {
    setBusy(true);
    setError('');
    try {
      await setPeriod({ start: fromLocalInput(start), end: fromLocalInput(end) });
      setPhase('fulfil');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  // Devis livraison géolocalisé dès que l'adresse est complète.
  useEffect(() => {
    if (mode !== 'DELIVERY' || !addr.postalCode || !addr.city) {
      setDelivQuote(null);
      return;
    }
    const id = setTimeout(async () => {
      setQuoting(true);
      try {
        const q = await api<typeof delivQuote & object>('/api/public/delivery/quote', {
          method: 'POST',
          body: {
            line1: addr.line1,
            postalCode: addr.postalCode,
            city: addr.city,
            country: 'BE',
            rentalHT: cart?.quote?.totals?.rentalHT ?? 0,
          },
        });
        setDelivQuote(q as typeof delivQuote);
      } catch {
        setDelivQuote(null);
      } finally {
        setQuoting(false);
      }
    }, 500);
    return () => clearTimeout(id);
  }, [mode, addr.line1, addr.postalCode, addr.city, cart?.quote?.totals?.rentalHT]);

  async function saveFulfil() {
    setBusy(true);
    setError('');
    try {
      if (mode === 'DELIVERY') {
        const q = await api<{ served: boolean; distanceKm: number }>(
          '/api/public/delivery/quote',
          {
            method: 'POST',
            body: { line1: addr.line1, postalCode: addr.postalCode, city: addr.city, country: 'BE' },
          },
        );
        if (!q.served) {
          setError(
            `Adresse hors de la zone de livraison (${q.distanceKm} km du dépôt). Contactez-nous pour un devis.`,
          );
          setBusy(false);
          return;
        }
      }
      await setFulfilment(
        mode === 'DELIVERY'
          ? { mode, address: { ...addr, country: 'BE' }, slot }
          : { mode },
      );
      setPhase(user ? 'review' : 'account');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  async function saveAccount() {
    setBusy(true);
    setError('');
    try {
      if (authMode === 'login') {
        await login(contact.email, password);
        await refresh();
      }
      setPhase('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible');
    } finally {
      setBusy(false);
    }
  }

  async function placeOrder(outcome: 'success' | 'decline') {
    setBusy(true);
    setError('');
    try {
      const checkout = await clientApi<{
        reservation: { id: string };
        token?: string;
      }>('/api/checkout', {
        method: 'POST',
        auth: user ? 'user' : 'none',
        body: {
          period: { start: fromLocalInput(start), end: fromLocalInput(end) },
          fulfilment:
            mode === 'DELIVERY'
              ? { mode, address: { ...addr, country: 'BE' }, slot }
              : { mode },
          contact: user ? undefined : contact,
          account: !user && authMode === 'create' ? { password } : undefined,
          promoCode: cart?.promoCode ?? undefined,
          acceptTerms: true,
          channel: 'WEB',
        },
      });
      if (checkout.token) await setToken(checkout.token);

      const pay = await clientApi<{
        number: string;
        qrDataUrl: string;
        invoiceNumber: string;
        fulfilment: { mode: string; slot: string | null };
      }>('/api/checkout/pay', {
        method: 'POST',
        auth: 'user',
        body: { reservationId: checkout.reservation.id, outcome },
      });
      setResult(pay);
      setPhase('done');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Le paiement a échoué');
      setPhase('pay');
    } finally {
      setBusy(false);
    }
  }

  const phaseIndex = { dates: 0, fulfil: 2, account: 3, review: 3, pay: 4, done: 5 }[phase];

  return (
    <div className="section container">
      <h1>Commande</h1>
      <Steps current={phaseIndex} />
      {error && <div className="alert alert-err" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="two-col">
        <div className="stack">
          {phase === 'dates' && (
            <div className="card card-pad stack">
              <h2>1. Confirmez vos dates</h2>
              <p className="muted small">
                Une seule période pour toute la commande. Les disponibilités de tous les articles
                seront vérifiées ensemble.
              </p>
              <div className="field-2">
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
                  <input
                    type="datetime-local"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
              </div>
              <button className="btn btn-primary" onClick={saveDates} disabled={busy}>
                Continuer
              </button>
            </div>
          )}

          {phase === 'fulfil' && (
            <div className="card card-pad stack">
              <h2>2. Retrait ou livraison</h2>
              <div className="pill-row">
                <button
                  className={`chip${mode === 'PICKUP' ? ' active' : ''}`}
                  onClick={() => setMode('PICKUP')}
                >
                  Click &amp; Collect (gratuit)
                </button>
                <button
                  className={`chip${mode === 'DELIVERY' ? ' active' : ''}`}
                  onClick={() => setMode('DELIVERY')}
                >
                  Livraison chantier / domicile
                </button>
              </div>
              {mode === 'DELIVERY' && (
                <div className="stack">
                  <div className="field">
                    <label>Adresse</label>
                    <AddressAutocomplete
                      value={addr.line1}
                      onChange={(line1) => setAddr({ ...addr, line1 })}
                      onPick={(a) =>
                        setAddr({
                          ...addr,
                          line1: a.line1,
                          postalCode: a.postalCode || addr.postalCode,
                          city: a.city || addr.city,
                        })
                      }
                      placeholder="Rue et numéro…"
                    />
                  </div>
                  <div className="field-2">
                    <div className="field">
                      <label>Code postal</label>
                      <input
                        value={addr.postalCode}
                        onChange={(e) => setAddr({ ...addr, postalCode: e.target.value })}
                        placeholder="1000"
                      />
                    </div>
                    <div className="field">
                      <label>Ville</label>
                      <input
                        value={addr.city}
                        onChange={(e) => setAddr({ ...addr, city: e.target.value })}
                      />
                    </div>
                  </div>
                  {quoting && <p className="small muted">Calcul du tarif de livraison…</p>}
                  {delivQuote && !quoting && (
                    <div
                      className={`alert ${delivQuote.served ? (delivQuote.free ? 'alert-ok' : 'alert-info') : 'alert-warn'}`}
                    >
                      {!delivQuote.served ? (
                        <>Hors zone de livraison ({delivQuote.distanceKm} km du dépôt). Contactez-nous pour un devis.</>
                      ) : delivQuote.free ? (
                        <>Livraison offerte 🎉 ({delivQuote.distanceKm} km — franchise atteinte)</>
                      ) : (
                        <>
                          Livraison : <strong>{formatEUR(delivQuote.feeHT)}</strong> HTVA —{' '}
                          {delivQuote.distanceKm} km depuis le dépôt
                        </>
                      )}
                    </div>
                  )}
                  <label className="row" style={{ gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={addr.isConstructionSite}
                      onChange={(e) =>
                        setAddr({ ...addr, isConstructionSite: e.target.checked })
                      }
                    />
                    <span className="small">Adresse de chantier</span>
                  </label>
                  <div className="field">
                    <label>Créneau souhaité</label>
                    <select value={slot} onChange={(e) => setSlot(e.target.value)}>
                      <option>Matin (8h-12h)</option>
                      <option>Après-midi (13h-17h)</option>
                    </select>
                  </div>
                  <p className="small muted">
                    Zones desservies (démo) : Bruxelles, Brabant wallon et flamand. Livraison
                    offerte dès 250 € HTVA de location.
                  </p>
                </div>
              )}
              <div className="row">
                <button className="btn btn-ghost" onClick={() => setPhase('dates')}>
                  Retour
                </button>
                <button className="btn btn-primary" onClick={saveFulfil} disabled={busy}>
                  Continuer
                </button>
              </div>
            </div>
          )}

          {phase === 'account' && (
            <div className="card card-pad stack">
              <h2>3. Vos coordonnées</h2>
              <div className="pill-row">
                <button
                  className={`chip${authMode === 'create' ? ' active' : ''}`}
                  onClick={() => setAuthMode('create')}
                >
                  Créer un compte
                </button>
                <button
                  className={`chip${authMode === 'login' ? ' active' : ''}`}
                  onClick={() => setAuthMode('login')}
                >
                  J&apos;ai déjà un compte
                </button>
                <button
                  className={`chip${authMode === 'guest' ? ' active' : ''}`}
                  onClick={() => setAuthMode('guest')}
                >
                  Sans compte
                </button>
              </div>

              {authMode !== 'login' && (
                <div className="field-2">
                  <div className="field">
                    <label>Prénom</label>
                    <input
                      value={contact.firstName}
                      onChange={(e) => setContact({ ...contact, firstName: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Nom</label>
                    <input
                      value={contact.lastName}
                      onChange={(e) => setContact({ ...contact, lastName: e.target.value })}
                    />
                  </div>
                </div>
              )}
              <div className="field-2">
                <div className="field">
                  <label>E-mail</label>
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(e) => setContact({ ...contact, email: e.target.value })}
                  />
                </div>
                {authMode !== 'login' && (
                  <div className="field">
                    <label>Téléphone</label>
                    <input
                      value={contact.phone}
                      onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                    />
                  </div>
                )}
              </div>
              {authMode !== 'guest' && (
                <div className="field">
                  <label>Mot de passe {authMode === 'create' && '(8 caractères min.)'}</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              )}
              <div className="row">
                <button className="btn btn-ghost" onClick={() => setPhase('fulfil')}>
                  Retour
                </button>
                <button
                  className="btn btn-primary"
                  onClick={saveAccount}
                  disabled={busy || (authMode === 'login' && (!contact.email || !password))}
                >
                  Continuer
                </button>
              </div>
            </div>
          )}

          {phase === 'review' && (
            <div className="card card-pad stack">
              <h2>4. Vérification</h2>
              <p>
                <strong>Période :</strong> {formatDateTimeBE(fromLocalInput(start))} →{' '}
                {formatDateTimeBE(fromLocalInput(end))}
              </p>
              <p>
                <strong>{mode === 'PICKUP' ? 'Retrait au comptoir' : 'Livraison'}</strong>
                {mode === 'DELIVERY' && ` — ${addr.line1}, ${addr.postalCode} ${addr.city} (${slot})`}
              </p>
              <p>
                <strong>Contact :</strong>{' '}
                {user ? `${user.firstName} ${user.lastName} (${user.email})` : `${contact.firstName} ${contact.lastName} (${contact.email})`}
              </p>
              <table className="table">
                <tbody>
                  {cart.quote?.lines.map((l) => (
                    <tr key={l.productId}>
                      <td>
                        {l.quantity} × {l.name}
                        {!l.isConsumable && (
                          <span className="small muted"> · {l.billedDays} j · {l.appliedRule}</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatEUR(l.lineHT)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <label className="row" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={accept}
                  onChange={(e) => setAccept(e.target.checked)}
                />
                <span className="small">
                  J&apos;accepte les <Link href="/legal">conditions générales de location</Link>{' '}
                  (démo).
                </span>
              </label>
              <div className="row">
                <button
                  className="btn btn-ghost"
                  onClick={() => setPhase(user ? 'fulfil' : 'account')}
                >
                  Retour
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!accept || !canReview}
                  onClick={() => setPhase('pay')}
                >
                  Aller au paiement
                </button>
              </div>
            </div>
          )}

          {phase === 'pay' && (
            <div className="card card-pad stack">
              <h2>5. Paiement — mode démonstration</h2>
              <div className="alert alert-info">
                Aucun paiement réel. Choisissez une carte de test :
              </div>
              <p className="price">{formatEUR(cart.quote?.totals.amountDue ?? 0)}</p>
              <div className="row">
                <button
                  className="btn btn-primary btn-lg"
                  disabled={busy}
                  onClick={() => placeOrder('success')}
                >
                  {busy ? '…' : 'Payer (carte « success »)'}
                </button>
                <button
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => placeOrder('decline')}
                >
                  Simuler un refus
                </button>
              </div>
            </div>
          )}
        </div>

        <CartSummary quote={cart.quote} title="Votre commande" />
      </div>
    </div>
  );
}
