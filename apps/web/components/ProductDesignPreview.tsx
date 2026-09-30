'use client';
import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { ProductGallery } from './ProductGallery';
import { StarRating } from './StarRating';
import { DateRangePicker } from './DateRangePicker';
import { CalendarClock, Truck, Home, ArrowRight } from './icons';

// Public snapshot for visual review; no reservation or cart writes.
const reference = 'https://new.bricoloc.be/produits/agrafeuse-pneumatique-15-40mm';
const photos = ['7QSnTwidirzv', '5j2OxJTza370', '7pLXui1WKefX'].map(name => `https://new.bricoloc.be/uploads/media/2026/09/${name}.webp`);
export function ProductDesignPreview() {
  const [picking, setPicking] = useState(false);
  const [period, setPeriod] = useState<{ start: Date; end: Date } | null>(null);
  const [mode, setMode] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState('');
  const date = (value: Date) => value.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' });
  const price = (20 * qty).toLocaleString('fr-BE', { style: 'currency', currency: 'EUR' });
  return <main className="pdraft">
    <div className="pdraft__review"><span>APERÇU · RÉFÉRENCE BRICOLOC</span><span>Aucune réservation effectuée</span><a href={reference} target="_blank" rel="noreferrer">Voir la fiche en ligne <ArrowRight /></a></div>
    <nav className="pdraft__breadcrumb" aria-label="Fil d’Ariane"><Link href="/catalogue">Catalogue</Link><span>/</span><span>Agrafeuse Pneumatique 15-40mm</span></nav>
    <div className="pdetail">
      <div className="pdetail__media"><ProductGallery images={photos} alt="Agrafeuse Pneumatique 15-40mm" tag="Travail du bois" /></div>
      <header className="pdetail__head"><p className="kicker">Travail du bois</p><h1>Agrafeuse Pneumatique 15-40mm</h1><a className="pdetail__rating" href={`${reference}#avis`} target="_blank" rel="noreferrer"><StarRating value={4.5} /><span>4,5 (6 avis)</span></a><p className="pdetail__lead">Pour couper, poncer et façonner le bois.</p><div className="pdetail__price"><span className="pdetail__price-label">À partir de</span><strong>20,00 €</strong><span className="pdetail__price-unit">TVAC / jour</span></div></header>
      <div className="pdetail__buy ppanel">
        <div className="field"><label id="draft-dates-label">Quand en avez-vous besoin ?</label><button className="ppanel__datebtn" type="button" aria-labelledby="draft-dates-label draft-dates-value" onClick={() => setPicking(true)}><CalendarClock /><span id="draft-dates-value">{period ? `${date(period.start)} → ${date(period.end)}` : 'Choisir mes dates'}</span></button></div>
        <fieldset className="pdraft__field"><legend>Comment souhaitez-vous le recevoir ?</legend><div className="ppanel__mode"><button className={`ppanel__modecard${mode === 'PICKUP' ? ' is-active' : ''}`} type="button" aria-pressed={mode === 'PICKUP'} onClick={() => setMode('PICKUP')}><Home /><strong>Click & Collect</strong><span>Retrait au dépôt</span></button><button className={`ppanel__modecard${mode === 'DELIVERY' ? ' is-active' : ''}`} type="button" aria-pressed={mode === 'DELIVERY'} onClick={() => setMode('DELIVERY')}><Truck /><strong>Livraison</strong><span>Domicile ou chantier · aller-retour</span></button></div></fieldset>
        <div className="field ppanel__qtyfield"><label>Quantité</label><div className="qty"><button type="button" aria-label="Retirer une unité" disabled={qty === 1} onClick={() => setQty(v => Math.max(1, v - 1))}>−</button><output aria-live="polite">{qty}</output><button type="button" aria-label="Ajouter une unité" onClick={() => setQty(v => v + 1)}>+</button></div></div>
        <div className="ppanel__total"><span>Exemple pour 1 jour · TVAC</span><strong>{price}</strong></div><button className="btn btn-primary pdraft__reserve" type="button" onClick={() => setMessage('Ceci est un aperçu : aucun article n’a été ajouté au panier.')}>Ajouter cet outil au panier <ArrowRight /></button><p className="pdraft__deposit">Caution : <strong>300,00 €</strong> · Empreinte bancaire bloquée puis libérée au retour.</p>{message && <p className="pdraft__feedback" role="status">{message}</p>}
      </div>
    </div>
    <section className="pessential"><p className="kicker">L’essentiel</p><h2>Prêt pour votre chantier.</h2><div className="pessential__grid"><div className="pessential__card pessential__card--intro"><h3>Description</h3><p>Louez agrafeuse pneumatique 15-40mm chez Bricoloc. Machine contrôlée et entretenue avant chaque location, fournie avec ses accessoires de base. Disponible à la journée, à la semaine (4× le tarif jour) ou au mois (12× le tarif jour), en retrait au dépôt de Ruisbroek ou en livraison sur chantier.</p></div><div className="pessential__card"><h3>Inclus dans votre location</h3><ul><li>Machine contrôlée avant chaque départ</li><li>Accessoires de base fournis</li></ul></div></div></section>
    {picking && <DateRangePicker initialStart={period?.start} initialEnd={period?.end} onClose={() => setPicking(false)} onApply={(start, end) => { setPeriod({ start, end }); setPicking(false); }} />}
  </main>;
}
