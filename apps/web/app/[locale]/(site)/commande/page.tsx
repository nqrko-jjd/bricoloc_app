'use client';
import { Link } from '@/i18n/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatEUR, formatDateTimeBE, icsDataUri } from '@bricoloc/shared';
import { api, clientApi, ApiError } from '@/lib/api';
import { useCart, useSession } from '@/lib/providers';
import { useKiosk } from '@/lib/kiosk';
import { CartSummary } from '@/components/CartSummary';
import { IdDocument } from '@/components/IdDocument';
import { Steps } from '@/components/Steps';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { fromLocalInput, toLocalInput, defaultPeriod } from '@/lib/dates';

type Phase = 'dates' | 'fulfil' | 'account' | 'identity' | 'review' | 'pay' | 'done';

/** L'identité est-elle en règle pour commander ? */
const idOk = (s?: string) => s === 'PENDING' || s === 'VERIFIED';

export default function CommandePage() {
  const { cart, setPeriod, setFulfilment, reload } = useCart();
  const { user, login, register, setToken, refresh } = useSession();
  const kiosk = useKiosk();

  const [phase, setPhase] = useState<Phase>('dates');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Borne : les dates + le retrait sont déjà choisis dans le parcours /borne/catalogue.
  // On saute directement aux coordonnées pour rester fluide.
  const skipped = useRef(false);
  useEffect(() => {
    if (skipped.current) return;
    if (kiosk && phase === 'dates' && cart?.period && cart?.fulfilmentMode) {
      skipped.current = true;
      setPhase('account');
    }
  }, [kiosk, phase, cart?.period, cart?.fulfilmentMode]);

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
  const [pickupPoints, setPickupPoints] = useState<
    { id: string; name: string; line1: string; postalCode: string; city: string; isMain: boolean; transferHours: number }[]
  >([]);
  const [pickupPointId, setPickupPointId] = useState('');
  const [payProvider, setPayProvider] = useState<'mock' | 'mollie'>('mock');
  const pickupPoint = pickupPoints.find((p) => p.id === pickupPointId) ?? pickupPoints[0];
  const [delivQuote, setDelivQuote] = useState<{
    served: boolean;
    distanceKm: number;
    feeHT: number;
    free: boolean;
    geocoded: boolean;
  } | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [authMode, setAuthMode] = useState<'login' | 'create'>('create');
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
    fulfilment: { mode: string; slot: string | null; pickupPoint?: { name: string; line1: string; postalCode: string; city: string; transferHours: number } | null };
  } | null>(null);

  useEffect(() => {
    api<{ pickupPoints?: typeof pickupPoints; paymentProvider?: 'mock' | 'mollie' }>(
      '/api/public/config',
    )
      .then((c) => {
        const pts = c.pickupPoints ?? [];
        setPickupPoints(pts);
        setPickupPointId(pts.find((p) => p.isMain)?.id ?? pts[0]?.id ?? '');
        setPayProvider(c.paymentProvider === 'mollie' ? 'mollie' : 'mock');
      })
      .catch(() => undefined);
  }, []);

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

  // Étape identité : passe directement à la vérif si la pièce est déjà fournie.
  // (doit rester AVANT les `return` conditionnels ci-dessous — règle des Hooks :
  // un Hook déclaré après un early return casse dès que le rendu change de branche,
  // React #310 « Rendered more hooks than during the previous render ».)
  useEffect(() => {
    if (phase === 'identity' && idOk(user?.idDocStatus)) setPhase('review');
  }, [phase, user?.idDocStatus]);

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
          {result.fulfilment.pickupPoint && (
            <p className="small">
              Enlèvement : <strong>{result.fulfilment.pickupPoint.name}</strong> —{' '}
              {result.fulfilment.pickupPoint.line1}, {result.fulfilment.pickupPoint.postalCode}{' '}
              {result.fulfilment.pickupPoint.city}
              {result.fulfilment.pickupPoint.transferHours > 0 && (
                <> · prêt sous {result.fulfilment.pickupPoint.transferHours} h</>
              )}
            </p>
          )}
          <p className="small">Facture : {result.invoiceNumber}</p>
          <a
            className="btn btn-ghost"
            href={icsDataUri({
              uid: `resa-${result.number}`,
              start: fromLocalInput(start),
              end: fromLocalInput(end),
              summary: `Location BRICOLOC ${result.number}`,
              description: `Réservation ${result.number}. Présentez le QR code au comptoir.`,
              location:
                result.fulfilment.mode === 'DELIVERY'
                  ? 'Livraison'
                  : result.fulfilment.pickupPoint
                    ? `${result.fulfilment.pickupPoint.name} — ${result.fulfilment.pickupPoint.line1}, ${result.fulfilment.pickupPoint.postalCode} ${result.fulfilment.pickupPoint.city}`
                    : 'BRICOLOC — Gieterijstraat 49, 1601 Ruisbroek',
            })}
            download={`reservation-${result.number}.ics`}
          >
            📅 Ajouter à mon agenda
          </a>
          {kiosk ? (
            <Link href="/borne" className="btn btn-primary btn-lg">
              Terminer
            </Link>
          ) : (
            <div className="row">
              <Link href="/compte" className="btn btn-primary">
                Voir mes réservations
              </Link>
              <Link href="/catalogue" className="btn btn-ghost">
                Nouvelle location
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="section container center">
        <h1>Panier vide</h1>
        <Link href={kiosk ? '/borne/catalogue' : '/catalogue'} className="btn btn-primary">
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
      // Borne : coordonnées invité simples, ni compte ni pièce d'identité.
      if (kiosk) setPhase('account');
      else setPhase(user ? (idOk(user.idDocStatus) ? 'review' : 'identity') : 'account');
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
      // Borne : pas de compte, on passe direct à la vérification.
      if (kiosk) {
        setPhase('review');
        return;
      }
      if (authMode === 'login') {
        await login(contact.email, password);
      } else {
        if (password.length < 8) throw new Error('Mot de passe : 8 caractères minimum.');
        await register({
          email: contact.email,
          password,
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phone,
          customerType: 'PARTICULIER',
        });
      }
      // La phase `identity` s'auto-avance vers `review` si l'identité est déjà OK.
      setPhase('identity');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible');
    } finally {
      setBusy(false);
    }
  }

  async function placeOrder(outcome: 'success' | 'decline' | 'onsite') {
    setBusy(true);
    setError('');
    try {
      const checkout = await clientApi<{
        reservation: { id: string };
        payment: { provider: string };
        token?: string;
      }>('/api/checkout', {
        method: 'POST',
        auth: kiosk ? 'none' : 'user',
        body: {
          period: { start: fromLocalInput(start), end: fromLocalInput(end) },
          fulfilment:
            mode === 'DELIVERY'
              ? { mode, address: { ...addr, country: 'BE' }, slot }
              : { mode, pickupPointId: pickupPointId || undefined },
          contact: kiosk ? contact : undefined,
          promoCode: cart?.promoCode ?? undefined,
          acceptTerms: true,
          channel: kiosk ? 'KIOSK' : 'WEB',
        },
      });
      if (checkout.token) await setToken(checkout.token);

      // Borne — paiement au comptoir : réservation confirmée, QR émis, rien à payer ici.
      if (outcome === 'onsite') {
        const done = await clientApi<{
          number: string;
          qrDataUrl: string;
          invoiceNumber: string;
          fulfilment: { mode: string; slot: string | null };
        }>('/api/checkout/reserve-onsite', {
          method: 'POST',
          auth: 'none',
          body: { reservationId: checkout.reservation.id },
        });
        setResult(done);
        setPhase('done');
        await reload();
        return;
      }

      // Paiement réel Mollie : redirection vers la page de paiement.
      if (checkout.payment.provider === 'mollie' && outcome === 'success') {
        const start = await clientApi<{ checkoutUrl: string | null }>(
          '/api/checkout/mollie/start',
          { method: 'POST', auth: 'user', body: { reservationId: checkout.reservation.id } },
        );
        if (start.checkoutUrl) {
          window.location.href = start.checkoutUrl;
          return;
        }
        throw new Error('Paiement Mollie indisponible.');
      }

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
      if (e instanceof ApiError && e.status === 409) {
        const code = (e.payload as { error?: { code?: string } })?.error?.code;
        if (code === 'ID_REQUIRED') {
          setError(e.message);
          await refresh();
          setPhase('identity');
          return;
        }
      }
      setError(e instanceof Error ? e.message : 'Le paiement a échoué');
      setPhase('pay');
    } finally {
      setBusy(false);
    }
  }

  const phaseIndex = {
    dates: 0,
    fulfil: 2,
    account: 3,
    identity: 3,
    review: 3,
    pay: 4,
    done: 5,
  }[phase];

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

              {mode === 'PICKUP' && pickupPoints.length > 1 && (
                <div className="field">
                  <label>Point d’enlèvement</label>
                  <div className="stack" style={{ gap: 8 }}>
                    {pickupPoints.map((p) => (
                      <label key={p.id} className="pickup-opt">
                        <input
                          type="radio"
                          name="pickupPoint"
                          checked={pickupPointId === p.id}
                          onChange={() => setPickupPointId(p.id)}
                        />
                        <span>
                          <strong>{p.name}</strong>
                          <span className="small muted">
                            {' '}
                            — {p.line1}, {p.postalCode} {p.city}
                          </span>
                          <span className="small" style={{ display: 'block', color: 'var(--primary)' }}>
                            {p.transferHours > 0
                              ? `Prêt sous ${p.transferHours} h (acheminé depuis le dépôt)`
                              : 'Prêt en 2 h selon disponibilité'}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
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
              {!kiosk && (
                <>
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
                  </div>
                  <p className="small muted" style={{ margin: 0 }}>
                    Un compte est nécessaire pour louer (contrat, caution, pièce d&apos;identité).
                  </p>
                </>
              )}
              {kiosk && (
                <p className="small muted" style={{ margin: 0 }}>
                  Vos coordonnées pour la préparation. Le paiement et la pièce d&apos;identité se
                  règlent au comptoir.
                </p>
              )}

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
              {!kiosk && (
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
                  disabled={
                    busy ||
                    !contact.email ||
                    (!kiosk && !password) ||
                    ((kiosk || authMode === 'create') &&
                      (!contact.firstName || !contact.lastName || !contact.phone))
                  }
                >
                  Continuer
                </button>
              </div>
            </div>
          )}

          {phase === 'identity' && (
            <div className="card card-pad stack">
              <h2>3. Pièce d’identité</h2>
              <IdDocument compact onUploaded={() => setError('')} />
              <div className="row">
                <button
                  className="btn btn-ghost"
                  onClick={() => setPhase(user ? 'fulfil' : 'account')}
                >
                  Retour
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!idOk(user?.idDocStatus)}
                  onClick={() => setPhase('review')}
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
                  onClick={() => setPhase(user ? 'identity' : 'account')}
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
              <h2>5. Paiement</h2>
              {kiosk ? (
                <div className="alert alert-info">
                  Payez maintenant sur la borne, ou au comptoir lors du retrait.
                </div>
              ) : payProvider === 'mollie' ? (
                <div className="alert alert-info">
                  Vous allez être redirigé vers la page de paiement sécurisée (Bancontact, carte…).
                </div>
              ) : (
                <div className="alert alert-info">Mode démonstration — aucun paiement réel.</div>
              )}
              <p className="price">{formatEUR(cart.quote?.totals.amountDue ?? 0)}</p>
              <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary btn-lg"
                  disabled={busy}
                  onClick={() => placeOrder('success')}
                >
                  {busy
                    ? '…'
                    : kiosk
                      ? 'Payer maintenant'
                      : payProvider === 'mollie'
                        ? 'Payer'
                        : 'Payer (carte « success »)'}
                </button>
                {kiosk && mode === 'PICKUP' && (
                  <button
                    className="btn btn-outline btn-lg"
                    disabled={busy}
                    onClick={() => placeOrder('onsite')}
                  >
                    Payer au comptoir
                  </button>
                )}
                {!kiosk && payProvider === 'mock' && (
                  <button
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => placeOrder('decline')}
                  >
                    Simuler un refus
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <CartSummary quote={cart.quote} title="Votre commande" />
      </div>
    </div>
  );
}
