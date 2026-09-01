'use client';
import { Link } from '@/i18n/navigation';
import { useState } from 'react';
import { formatEUR } from '@bricoloc/shared';
import { useCart } from '@/lib/providers';
import { CartSummary } from '@/components/CartSummary';
import { Steps } from '@/components/Steps';
import { AvailabilityBadge } from '@/components/AvailabilityBadge';
import { PLACEHOLDER_IMG } from '@/lib/placeholder';

export default function PanierPage() {
  const { cart, loading, setQty, removeItem, addItem, applyPromo, clearPromo } = useCart();
  const [promo, setPromo] = useState('');
  const [promoErr, setPromoErr] = useState('');

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

  return (
    <div className="section container">
      <h1>Votre panier</h1>
      <Steps current={cart.recommendations.length > 0 ? 1 : 0} />

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
                    ? `seulement ${a.availableQty} disponible(s) sur ${a.requestedQty}`
                    : a.status === 'NEARBY'
                      ? 'indisponible sur la période, mais disponible à des dates proches'
                      : 'indisponible sur la période choisie'}
                </li>
              );
            })}
          </ul>
          <p className="small" style={{ margin: '6px 0 0' }}>
            Corrigez les quantités ou les dates — inutile de recommencer votre commande.
          </p>
        </div>
      )}

      <div className="two-col">
        <div className="stack">
          {cart.items.map((it) => (
            <div key={it.id} className="card card-body row" style={{ alignItems: 'flex-start' }}>
              <img
                src={it.image || PLACEHOLDER_IMG}
                alt={it.name}
                style={{ width: 100, borderRadius: 8 }}
              />
              <div style={{ flex: 1, minWidth: 180 }}>
                <Link href={`/produits/${it.slug}`} style={{ fontWeight: 700 }}>
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
              <div className="stack" style={{ gap: 6, alignItems: 'flex-end' }}>
                <input
                  type="number"
                  min={1}
                  value={it.quantity}
                  style={{ width: 70 }}
                  onChange={(e) => setQty(it.productId, Math.max(1, Number(e.target.value)))}
                />
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => removeItem(it.productId)}
                >
                  Retirer
                </button>
              </div>
            </div>
          ))}

          {cart.recommendations.map((g) => (
            <div key={g.type + g.label} className="card card-body">
              <h3 style={{ fontSize: '1rem' }}>{g.label}</h3>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
                {g.products.map((p) => (
                  <div key={p.id} className="card card-body" style={{ boxShadow: 'none' }}>
                    <Link href={`/produits/${p.slug}`} className="small" style={{ fontWeight: 700 }}>
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
          <Link
            href="/commande"
            className="btn btn-primary btn-lg btn-block"
            aria-disabled={cart.hasBlockingIssue}
          >
            Valider le panier
          </Link>
          {!cart.period && (
            <p className="small muted center">
              Vos dates seront demandées à l&apos;étape suivante.
            </p>
          )}
          <Link href="/catalogue" className="btn btn-ghost btn-block">
            Continuer mes achats
          </Link>
        </div>
      </div>
    </div>
  );
}
