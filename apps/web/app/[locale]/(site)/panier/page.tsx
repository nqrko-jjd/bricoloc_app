'use client';
import { Link } from '@/i18n/navigation';
import { useState } from 'react';
import { formatEUR, formatDateBE } from '@bricoloc/shared';
import { useCart } from '@/lib/providers';
import { durationLabel } from '@/lib/dates';
import { CartSummary } from '@/components/CartSummary';
import { Steps } from '@/components/Steps';
import { AvailabilityBadge } from '@/components/AvailabilityBadge';
import { DateRangePicker } from '@/components/DateRangePicker';
import { PLACEHOLDER_IMG } from '@/lib/placeholder';
import { productHref } from '@/lib/productHref';

export default function PanierPage() {
  const { cart, loading, setQty, removeItem, addItem, applyPromo, clearPromo, setPeriod } = useCart();
  const [promo, setPromo] = useState('');
  const [promoErr, setPromoErr] = useState('');
  const [picking, setPicking] = useState(false);

  if (loading && !cart) return <div className="section container">Chargement du panier…</div>;
  if (!cart || cart.items.length === 0)
    return (
      <div className="section container center stack" style={{ alignItems: 'center' }}>
        <h1>Votre panier est vide</h1>
        <p className="muted">Ajoutez des machines, des accessoires et des consommables.</p>
        <Link href="/catalogue" className="btn btn-primary btn-lg">
          Parcourir le catalogue
        </Link>
      </div>
    );

  const period = cart.period;
  const lineOf = (productId: string) => cart.quote?.lines.find((l) => l.productId === productId);

  return (
    <div className="section container">
      <h1>Votre panier</h1>
      <Steps current={cart.recommendations.length > 0 ? 1 : 0} />

      {/* Les dates se choisissent ICI : prix exact + disponibilités dès le panier,
          sans devoir aller à la commande puis revenir corriger. */}
      <div className={`card card-body card--flat cart-dates${period ? '' : ' cart-dates--empty'}`} style={{ marginBottom: 16 }}>
        <div>
          <span className="small muted">DATES DE LOCATION</span>
          <strong>
            {period
              ? `${formatDateBE(period.start)} → ${formatDateBE(period.end)} · ${durationLabel(period.start, period.end)}`
              : 'Choisissez vos dates'}
          </strong>
          {!period && (
            <span className="small muted">
              Pour voir le prix exact, la disponibilité de chaque article et les réductions longue durée.
            </span>
          )}
        </div>
        <button className={`btn btn-sm ${period ? 'btn-outline' : 'btn-primary'}`} onClick={() => setPicking(true)}>
          {period ? 'Modifier' : 'Choisir mes dates'}
        </button>
      </div>
      {picking && (
        <DateRangePicker
          initialStart={period ? new Date(period.start) : undefined}
          initialEnd={period ? new Date(period.end) : undefined}
          onClose={() => setPicking(false)}
          onApply={async (s, e) => {
            await setPeriod({ start: s.toISOString(), end: e.toISOString() });
            setPicking(false);
          }}
        />
      )}

      {cart.availabilityAlerts.length > 0 && (
        <div className="alert alert-warn" style={{ marginBottom: 16 }}>
          <strong>Vérification des disponibilités :</strong>
          <ul style={{ margin: '6px 0 0' }}>
            {cart.availabilityAlerts.map((a) => {
              const item = cart.items.find((i) => i.productId === a.productId);
              return (
                <li key={a.productId}>
                  {item?.name} —{' '}
                  {a.status === 'PARTIAL'
                    ? <>seulement {a.availableQty} disponible(s) sur {a.requestedQty}{a.availableQty > 0 && (<>{' '}<button className="linklike" onClick={() => setQty(a.productId, a.availableQty)}>Ramener à {a.availableQty}</button></>)}</>
                    : a.status === 'NEARBY'
                      ? 'indisponible sur la période, mais disponible à des dates proches'
                      : 'indisponible sur la période choisie'}
                </li>
              );
            })}
          </ul>
          <p className="small" style={{ margin: '6px 0 0' }}>
            Corrigez les quantités ou{' '}
            <button className="linklike" onClick={() => setPicking(true)}>
              changez vos dates
            </button>{' '}
            — inutile de recommencer votre commande.
          </p>
        </div>
      )}

      <div className="two-col">
        <div className="stack">
          {cart.items.map((it) => {
            const line = lineOf(it.productId);
            return (
              <div key={it.id} className="card card-body row" style={{ alignItems: 'flex-start' }}>
                <img
                  src={it.image || PLACEHOLDER_IMG}
                  alt={it.name}
                  style={{ width: 100, borderRadius: 8 }}
                />
                <div style={{ flex: 1, minWidth: 180 }}>
                  <Link href={productHref(it)} style={{ fontWeight: 700 }}>
                    {it.name}
                  </Link>
                  <div className="small muted">
                    {formatEUR(it.dailyPrice)} / {it.isConsumable ? 'unité' : 'jour'}
                    {!it.isConsumable && ` · caution ${formatEUR(it.deposit)}`}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <AvailabilityBadge a={it.availability} />
                  </div>
                </div>
                <div className="stack" style={{ gap: 8, alignItems: 'flex-end' }}>
                  <div className="qty" role="group" aria-label={`Quantité de ${it.name}`}>
                    <button
                      type="button"
                      aria-label="Diminuer la quantité"
                      disabled={it.quantity <= 1}
                      onClick={() => setQty(it.productId, Math.max(1, it.quantity - 1))}
                    >
                      −
                    </button>
                    <output aria-live="polite">{it.quantity}</output>
                    <button
                      type="button"
                      aria-label="Augmenter la quantité"
                      onClick={() => setQty(it.productId, it.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  {line && (
                    <span className="cart-line-total">
                      {formatEUR(line.lineHT)}
                      <span className="small muted"> HTVA{!it.isConsumable && line.billedDays > 0 ? ` · ${line.billedDays} j` : ''}</span>
                    </span>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => removeItem(it.productId)}>
                    Retirer
                  </button>
                </div>
              </div>
            );
          })}

          {cart.recommendations.map((g) => (
            <div key={g.type + g.label} className="card card-body">
              <h3 style={{ fontSize: '1rem' }}>{g.label}</h3>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
                {g.products.map((p) => (
                  <div key={p.id} className="card card-body" style={{ boxShadow: 'none' }}>
                    <Link href={productHref(p)} className="small" style={{ fontWeight: 700 }}>
                      {p.name}
                    </Link>
                    <div className="small muted">
                      {formatEUR(p.dailyPrice)} / {p.isConsumable ? 'unité' : 'jour'}
                    </div>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ marginTop: 6 }}
                      onClick={() => addItem(p.id, 1)}
                    >
                      + Ajouter
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="card card-body">
            <h3 style={{ fontSize: '1rem' }}>Code promo</h3>
            {cart.promoCode ? (
              <div className="row">
                <span className="badge badge-ok">{cart.promoCode}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => clearPromo()}>
                  Retirer
                </button>
              </div>
            ) : (
              <div className="row">
                <input
                  placeholder="BIENVENUE10"
                  value={promo}
                  onChange={(e) => setPromo(e.target.value)}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    setPromoErr('');
                    try {
                      await applyPromo(promo);
                    } catch (e) {
                      setPromoErr(e instanceof Error ? e.message : 'Code invalide');
                    }
                  }}
                >
                  Appliquer
                </button>
              </div>
            )}
            {promoErr && <p className="small" style={{ color: 'var(--err)' }}>{promoErr}</p>}
            <p className="small muted">Codes démo : BIENVENUE10, CHANTIER25</p>
          </div>
        </div>

        <div className="stack">
          <CartSummary quote={cart.quote} />
          {cart.hasBlockingIssue ? (
            <>
              <button className="btn btn-primary btn-lg btn-block" disabled>
                Continuer
              </button>
              <p className="small center" style={{ color: 'var(--err)', margin: 0 }}>
                Un article n’est pas disponible sur ces dates : corrigez la quantité ou{' '}
                <button className="linklike" onClick={() => setPicking(true)}>
                  changez vos dates
                </button>
                .
              </p>
            </>
          ) : !period ? (
            <button className="btn btn-primary btn-lg btn-block" onClick={() => setPicking(true)}>
              Choisir mes dates pour continuer
            </button>
          ) : (
            <Link href="/commande" className="btn btn-primary btn-lg btn-block">
              Continuer vers la commande
            </Link>
          )}
          <Link href="/catalogue" className="btn btn-ghost btn-block">
            Continuer mes achats
          </Link>
        </div>
      </div>
    </div>
  );
}
