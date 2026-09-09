'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import { formatEUR, suggestDegressivePricing } from '@bricoloc/shared';
import { staffApi } from '@/lib/staff';
import { ImageDropzone } from '@/components/admin/ImageDropzone';
import { PLACEHOLDER_IMG } from '@/lib/placeholder';
import type { ProductDetail, Category } from '@/lib/types';

type CreateMode = 'MACHINE' | 'TECHNICAL' | 'ACCESSORY' | 'CONSUMABLE' | 'PPE';

// Termes (2026-09-09, à la demande de David) : ce qu'on appelait « machine
// (vitrine) » est une fiche produit e-commerce (nom générique, prix, montrée
// au client) ; ce qu'on appelait « fiche technique » EST la machine réelle
// (marque/modèle précis, exemplaires physiques, fournisseurs) — le CreateMode
// interne 'MACHINE'/'TECHNICAL' ne change pas (trop de logique en dépend),
// seuls les libellés affichés changent.
const CREATE_TITLES: Record<CreateMode, string> = {
  MACHINE: 'Nouvelle fiche produit',
  TECHNICAL: 'Nouvelle machine',
  ACCESSORY: 'Nouvel accessoire',
  CONSUMABLE: 'Nouveau consommable',
  PPE: 'Nouvelle protection (EPI)',
};
const EDIT_TITLES: Record<CreateMode, string> = {
  MACHINE: 'Fiche produit',
  TECHNICAL: 'Machine',
  ACCESSORY: 'Accessoire',
  CONSUMABLE: 'Consommable',
  PPE: 'Protection (EPI)',
};

type KindFilter = 'CATALOG' | 'MACHINE' | 'TECHNICAL' | 'ACCESSORY' | 'CONSUMABLE' | 'PPE';
const FILTER_LABELS: Record<KindFilter, string> = {
  CATALOG: 'Catalogue (tout ce qui est vendable)',
  MACHINE: 'Fiches produits',
  TECHNICAL: 'Machines',
  ACCESSORY: 'Accessoires',
  CONSUMABLE: 'Consommables',
  PPE: 'Protections (EPI)',
};

const EMPTY = {
  id: '',
  slug: '',
  name: '',
  kind: 'MACHINE',
  brand: '',
  model: '',
  categorySlug: 'percage-demolition',
  shortDescription: '',
  description: '',
  recommendedUses: '',
  dailyPrice: '30',
  weekendPrice: '',
  weekPrice: '',
  monthPrice: '',
  tiers: '',
  deposit: '200',
  stockQty: '',
  published: true,
  isNew: false,
  images: [] as string[],
  // Complétez votre location (fiche produit + borne) : liens vers d'autres produits.
  recommendedAccessoryIds: [] as string[],
  consumableIds: [] as string[],
  ppeIds: [] as string[],
  complementaryProductIds: [] as string[],
  // Internes
  parentProductId: '',
  partSupplier: '',
  supplierRef: '',
  supplierUrl: '',
  supplierListPrice: '',
  purchasePrice: '',
  // Machine : notre réf. + fournisseurs possibles (plusieurs sources d'achat).
  internalRef: '',
  suppliers: [] as SupplierRow[],
  // Machine : partenaires de secours possibles (plusieurs — Loiselet, Loxam…).
  partners: [] as PartnerRow[],
};

type SupplierRow = {
  name: string;
  ref: string;
  url: string;
  listPrice: string;
  purchasePrice: string;
};
const EMPTY_SUPPLIER: SupplierRow = { name: '', ref: '', url: '', listPrice: '', purchasePrice: '' };

type PartnerRow = {
  name: string;
  ref: string;
  url: string;
  costPerDay: string;
  insurancePct: string;
  availabilityMode: string;
};
const EMPTY_PARTNER: PartnerRow = {
  name: '',
  ref: '',
  url: '',
  costPerDay: '',
  insurancePct: '',
  availabilityMode: 'ON_REQUEST',
};

export default function AdminProduits() {
  const [products, setProducts] = useState<ProductDetail[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [mode, setMode] = useState<CreateMode | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('CATALOG');
  const [mergingSlug, setMergingSlug] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState('');
  const [convertingSlug, setConvertingSlug] = useState<string | null>(null);
  const [convertTarget, setConvertTarget] = useState('');
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [attachPick, setAttachPick] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  async function load() {
    const [p, c, st] = await Promise.all([
      staffApi<{ products: ProductDetail[] }>('/api/admin/products'),
      staffApi<{ categories: Category[] }>('/api/admin/categories'),
      staffApi<{ settings: { homeFeaturedProductIds?: string[] } }>('/api/admin/settings'),
    ]);
    setProducts(p.products);
    setCategories(c.categories);
    setFeaturedIds(Array.isArray(st.settings.homeFeaturedProductIds) ? st.settings.homeFeaturedProductIds : []);
  }

  async function toggleFeatured(p: ProductDetail) {
    const next = featuredIds.includes(p.id)
      ? featuredIds.filter((x) => x !== p.id)
      : [...featuredIds, p.id];
    setFeaturedIds(next);
    try {
      await staffApi('/api/admin/settings', {
        method: 'PUT',
        body: { key: 'homeFeaturedProductIds', value: next },
      });
      setMsg(
        next.includes(p.id)
          ? `« ${p.name} » ajouté à « Ce que louent nos clients » (accueil).`
          : `« ${p.name} » retiré de l'accueil.`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
      await load();
    }
  }
  useEffect(() => {
    load();
  }, []);

  const set = (k: string, v: unknown) => setForm((s) => ({ ...s, [k]: v }));

  const dailyNum = Number(form.dailyPrice);
  const autoPricing =
    mode === 'MACHINE' && dailyNum > 0 ? suggestDegressivePricing(dailyNum) : null;

  function startCreate(m: CreateMode) {
    setMode(m);
    setEditingId(null);
    setForm({ ...EMPTY, kind: m === 'TECHNICAL' ? 'MACHINE' : m });
    setAttachPick('');
    setMsg('');
    requestAnimationFrame(() =>
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  function closeForm() {
    setMode(null);
    setEditingId(null);
    setForm(EMPTY);
    setAttachPick('');
  }

  function edit(p: ProductDetail) {
    const m: CreateMode = p.technical ? 'TECHNICAL' : (p.kind as CreateMode);
    setMode(m);
    setEditingId(p.id);
    setForm({
      id: p.id,
      slug: p.slug,
      name: p.name,
      kind: p.kind,
      brand: p.brand ?? '',
      model: p.model ?? '',
      categorySlug: p.category?.slug ?? '',
      shortDescription: p.shortDescription ?? '',
      description: p.description ?? '',
      recommendedUses: p.recommendedUses.join('\n'),
      dailyPrice: String(p.dailyPrice),
      weekendPrice: p.weekendPrice != null ? String(p.weekendPrice) : '',
      weekPrice: p.weekPrice != null ? String(p.weekPrice) : '',
      monthPrice: p.monthPrice != null ? String(p.monthPrice) : '',
      tiers: p.tiers.length ? JSON.stringify(p.tiers) : '',
      deposit: String(p.deposit),
      stockQty: p.stockQty != null ? String(p.stockQty) : '',
      published: p.published ?? true,
      isNew: p.isNew ?? false,
      images: p.images,
      recommendedAccessoryIds: p.recommendedAccessories.map((x) => x.id),
      consumableIds: p.consumables.map((x) => x.id),
      ppeIds: p.ppe.map((x) => x.id),
      complementaryProductIds: p.complementary.map((x) => x.id),
      parentProductId: p.parentProductId ?? '',
      partSupplier: p.partSupplier ?? '',
      supplierRef: p.supplierRef ?? '',
      supplierUrl: p.supplierUrl ?? '',
      supplierListPrice: p.supplierListPrice != null ? String(p.supplierListPrice) : '',
      purchasePrice: p.purchasePrice != null ? String(p.purchasePrice) : '',
      internalRef: p.internalRef ?? '',
      suppliers: (p.suppliers ?? []).map((s) => ({
        name: s.name ?? '',
        ref: s.ref ?? '',
        url: s.url ?? '',
        listPrice: s.listPrice != null ? String(s.listPrice) : '',
        purchasePrice: s.purchasePrice != null ? String(s.purchasePrice) : '',
      })),
      partners: (p.partners ?? []).map((pt) => ({
        name: pt.name ?? '',
        ref: pt.ref ?? '',
        url: pt.url ?? '',
        costPerDay: pt.costPerDay != null ? String(pt.costPerDay) : '',
        insurancePct: pt.insurancePct != null ? String(Math.round(pt.insurancePct * 1000) / 10) : '',
        availabilityMode: pt.availabilityMode ?? 'ON_REQUEST',
      })),
    });
    setAttachPick('');
    requestAnimationFrame(() =>
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!mode) return;
    setMsg('');
    const isTechnical = mode === 'TECHNICAL';
    const isConsumable = mode === 'CONSUMABLE';
    const isMachine = mode === 'MACHINE';
    try {
      const body = {
        id: form.id || undefined,
        slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: form.name,
        kind: isTechnical ? 'MACHINE' : mode,
        brand: isTechnical ? form.brand || null : null,
        model: isTechnical ? form.model || null : null,
        categorySlug: isTechnical ? undefined : form.categorySlug || undefined,
        shortDescription: form.shortDescription || undefined,
        description: form.description || undefined,
        recommendedUses:
          !isTechnical && form.recommendedUses
            ? form.recommendedUses.split('\n').filter(Boolean)
            : [],
        dailyPrice: isTechnical ? 0 : Number(form.dailyPrice),
        weekendPrice: isTechnical || isConsumable ? null : form.weekendPrice ? Number(form.weekendPrice) : null,
        weekPrice: isTechnical || isConsumable ? null : form.weekPrice ? Number(form.weekPrice) : null,
        monthPrice: isTechnical || isConsumable ? null : form.monthPrice ? Number(form.monthPrice) : null,
        tiers: isMachine && form.tiers ? JSON.parse(form.tiers) : [],
        deposit: isTechnical ? 0 : Number(form.deposit),
        published: isTechnical ? false : form.published,
        isNew: isTechnical ? false : form.isNew,
        images: form.images,
        recommendedAccessoryIds: isMachine ? form.recommendedAccessoryIds : [],
        consumableIds: isMachine ? form.consumableIds : [],
        ppeIds: isMachine ? form.ppeIds : [],
        complementaryProductIds: isMachine ? form.complementaryProductIds : [],
        stockQty: !isTechnical && !isMachine && form.stockQty ? Number(form.stockQty) : null,
        parentProductId: isTechnical ? form.parentProductId || null : null,
        technical: isTechnical,
        partSupplier: form.partSupplier || null,
        supplierRef: form.supplierRef || null,
        supplierUrl: form.supplierUrl || null,
        supplierListPrice: form.supplierListPrice ? Number(form.supplierListPrice) : null,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
        internalRef: isTechnical ? form.internalRef || null : null,
        suppliers: isTechnical
          ? form.suppliers
              .filter((s) => s.name || s.ref || s.url || s.listPrice || s.purchasePrice)
              .map((s) => ({
                name: s.name || undefined,
                ref: s.ref || undefined,
                url: s.url || undefined,
                listPrice: s.listPrice ? Number(s.listPrice) : null,
                purchasePrice: s.purchasePrice ? Number(s.purchasePrice) : null,
              }))
          : [],
        partners: isTechnical
          ? form.partners
              .filter((pt) => pt.name || pt.ref || pt.url || pt.costPerDay || pt.insurancePct)
              .map((pt) => ({
                name: pt.name || undefined,
                ref: pt.ref || undefined,
                url: pt.url || undefined,
                costPerDay: pt.costPerDay ? Number(pt.costPerDay) : null,
                insurancePct: pt.insurancePct ? Number(pt.insurancePct) / 100 : null,
                availabilityMode: pt.availabilityMode || 'ON_REQUEST',
              }))
          : [],
      };
      await staffApi('/api/admin/products', { method: 'POST', body });
      setMsg(editingId ? 'Fiche mise à jour.' : 'Fiche créée.');
      closeForm();
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function remove(p: ProductDetail) {
    if (!confirm(`Supprimer définitivement « ${p.name} » ?`)) return;
    try {
      await staffApi(`/api/admin/products/${p.slug}`, { method: 'DELETE' });
      setMsg('Produit supprimé.');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function merge(dup: ProductDetail, targetSlug: string) {
    if (!targetSlug) return;
    const target = products.find((p) => p.slug === targetSlug);
    if (!confirm(`Fusionner « ${dup.name} » dans « ${target?.name ?? targetSlug} » ? Stock, réservations et avis seront réattribués, puis « ${dup.name} » sera supprimé.`)) return;
    try {
      await staffApi(`/api/admin/products/${dup.slug}/merge-into`, {
        method: 'POST',
        body: { targetSlug },
      });
      setMsg(`Fusionné dans « ${target?.name ?? targetSlug} ».`);
      setMergingSlug(null);
      setMergeTarget('');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function attachVariant(childId: string, parentProductId: string) {
    try {
      await staffApi(`/api/admin/products/${childId}/parent`, {
        method: 'PATCH',
        body: { parentProductId },
      });
      setMsg('Machine rattachée.');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function convertToTechnical(p: ProductDetail, targetId: string) {
    if (!targetId) return;
    const target = products.find((x) => x.id === targetId);
    if (
      !confirm(
        `Transformer « ${p.name} » en machine de « ${target?.name ?? ''} » ? Elle disparaît du catalogue public et son stock rejoint celui de la fiche produit.`,
      )
    )
      return;
    await attachVariant(p.id, targetId);
    setConvertingSlug(null);
    setConvertTarget('');
  }

  /** Bascule une fiche en machine sans choisir de fiche produit tout de
   * suite (rattachement possible plus tard, depuis la fiche produit ou en
   * éditant cette fiche). */
  async function makeTechnical(p: ProductDetail) {
    if (
      !confirm(
        `Transformer « ${p.name} » en machine, sans la rattacher à une fiche produit pour l’instant ? Elle disparaît du catalogue public.`,
      )
    )
      return;
    try {
      await staffApi(`/api/admin/products/${p.id}/parent`, {
        method: 'PATCH',
        body: { parentProductId: null },
      });
      setMsg(`« ${p.name} » est maintenant une machine (non rattachée).`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    }
    setConvertingSlug(null);
    setConvertTarget('');
  }

  async function detachVariant(childId: string, childName: string) {
    if (!confirm(`Détacher « ${childName} » de sa fiche produit ? Elle redevient une machine indépendante (non publiée).`)) return;
    try {
      await staffApi(`/api/admin/products/${childId}/parent`, {
        method: 'PATCH',
        body: { parentProductId: null },
      });
      setMsg('Machine détachée.');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    }
  }

  const shown = products
    .filter((p) => p.kind !== 'PACK')
    .filter((p) => {
      if (kindFilter === 'CATALOG') return !p.technical;
      if (kindFilter === 'TECHNICAL') return !!p.technical;
      return p.kind === kindFilter && !p.technical;
    })
    .filter((p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase()));

  // Doublons possibles : même nom normalisé (casse/accents/espaces ignorés).
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const nameCounts = new Map<string, number>();
  for (const p of products) {
    if (p.kind === 'PACK' || p.technical) continue;
    const key = normalize(p.name);
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }
  const isDuplicate = (p: ProductDetail) =>
    !p.technical && (nameCounts.get(normalize(p.name)) ?? 0) > 1;

  // Fiches produits candidates pour « rattacher » une machine (créée ou en édition).
  const vitrineOptions = products.filter((p) => p.kind === 'MACHINE' && !p.parentProductId && !p.technical);

  const isTechnical = mode === 'TECHNICAL';
  const isMachine = mode === 'MACHINE';
  const isConsumableMode = mode === 'CONSUMABLE';
  const showRentalPricing = mode === 'MACHINE' || mode === 'ACCESSORY' || mode === 'PPE';
  const showStockFields = mode === 'ACCESSORY' || mode === 'CONSUMABLE' || mode === 'PPE';
  const current = editingId ? products.find((p) => p.id === editingId) : undefined;

  return (
    <div className="stack">
      <h1>Catalogue &amp; produits</h1>

      <div className="card card-body">
        <p className="small muted" style={{ margin: '0 0 10px' }}>
          Choisissez ce que vous créez : une <strong>fiche produit</strong> est ce que le client voit
          (nom générique, prix, page publique) ; une <strong>machine</strong> est l&apos;exemplaire réel
          (marque/modèle, fournisseurs, exemplaires physiques) rattaché à une fiche produit — elle n&apos;a
          ni prix ni page publique à elle.
        </p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => startCreate('MACHINE')}>
            + Nouvelle fiche produit
          </button>
          <button type="button" className="btn btn-sm" onClick={() => startCreate('TECHNICAL')}>
            + Machine
          </button>
          <button type="button" className="btn btn-sm" onClick={() => startCreate('ACCESSORY')}>
            + Accessoire
          </button>
          <button type="button" className="btn btn-sm" onClick={() => startCreate('CONSUMABLE')}>
            + Consommable
          </button>
          <button type="button" className="btn btn-sm" onClick={() => startCreate('PPE')}>
            + Protection (EPI)
          </button>
        </div>
      </div>

      {mode && (
        <form className="card card-pad stack" onSubmit={submit} ref={formRef}>
          <div className="spread">
            <h3>{editingId ? `Modifier — ${EDIT_TITLES[mode]} : ${form.name || '…'}` : CREATE_TITLES[mode]}</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={closeForm}>
              Fermer
            </button>
          </div>
          {msg && <div className="alert alert-info">{msg}</div>}

          <div className="field-2">
            <div className="field">
              <label>Nom {isTechnical && <span className="small muted">(usage interne, ex. « Makita 9741S »)</span>}</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            <div className="field">
              <label>Slug (URL)</label>
              <input
                value={form.slug}
                onChange={(e) => set('slug', e.target.value)}
                placeholder="auto depuis le nom"
              />
              {editingId && !isTechnical && (
                <span className="small muted">
                  Change l’adresse publique de la fiche (les anciens liens/QR ne suivront pas).
                </span>
              )}
            </div>
          </div>

          {isTechnical && (
            <>
              <div className="field-2">
                <div className="field">
                  <label>Marque</label>
                  <input
                    value={form.brand}
                    onChange={(e) => set('brand', e.target.value)}
                    placeholder="ex. Makita"
                  />
                </div>
                <div className="field">
                  <label>Modèle</label>
                  <input
                    value={form.model}
                    onChange={(e) => set('model', e.target.value)}
                    placeholder="ex. 9741S"
                  />
                </div>
              </div>
              <div className="field">
                <label>Rattachée à la fiche produit</label>
                <select
                  value={form.parentProductId}
                  onChange={(e) => set('parentProductId', e.target.value)}
                >
                  <option value="">— Non rattachée pour l’instant —</option>
                  {vitrineOptions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                <span className="small muted">
                  Le client réserve la fiche produit, jamais cette machine directement. Vous
                  pourrez aussi la rattacher plus tard depuis la fiche produit.
                </span>
              </div>
            </>
          )}

          {!isTechnical && (
            <div className="field">
              <label>Catégorie</label>
              <select
                value={form.categorySlug}
                onChange={(e) => set('categorySlug', e.target.value)}
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field">
            <label>Description courte {isTechnical && <span className="small muted">(note interne)</span>}</label>
            <input
              value={form.shortDescription}
              onChange={(e) => set('shortDescription', e.target.value)}
            />
          </div>
          {!isTechnical && (
            <div className="field">
              <label>Description</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>
          )}
          {isMachine && (
            <div className="field">
              <label>Utilisations conseillées (une par ligne)</label>
              <textarea
                rows={2}
                value={form.recommendedUses}
                onChange={(e) => set('recommendedUses', e.target.value)}
              />
            </div>
          )}

          {isConsumableMode && (
            <div className="field-2">
              <div className="field">
                <label>Prix unitaire (HTVA)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.dailyPrice}
                  onChange={(e) => set('dailyPrice', e.target.value)}
                />
              </div>
              <div className="field">
                <label>Caution</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.deposit}
                  onChange={(e) => set('deposit', e.target.value)}
                />
              </div>
            </div>
          )}

          {showRentalPricing && (
            <>
              <div className="field-2">
                <div className="field">
                  <label>Prix jour (HTVA)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.dailyPrice}
                    onChange={(e) => set('dailyPrice', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Caution</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.deposit}
                    onChange={(e) => set('deposit', e.target.value)}
                  />
                </div>
              </div>
              <div className="field-3">
                <div className="field">
                  <label>Prix week-end</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.weekendPrice}
                    onChange={(e) => set('weekendPrice', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Prix semaine (7 j)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.weekPrice}
                    onChange={(e) => set('weekPrice', e.target.value)}
                    placeholder={autoPricing ? String(autoPricing.weekPrice) : ''}
                  />
                </div>
                <div className="field">
                  <label>Prix mois (30 j)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.monthPrice}
                    onChange={(e) => set('monthPrice', e.target.value)}
                    placeholder={autoPricing ? String(autoPricing.monthPrice) : ''}
                  />
                </div>
              </div>
            </>
          )}
          {isMachine && (
            <>
              <p className="small muted" style={{ marginTop: -6 }}>
                Laisse semaine / mois / dégressif <b>vides</b> → calculés automatiquement depuis le
                prix jour (semaine −50 %, mois −60 %, palier dès le 3<sup>e</sup> jour).
                {autoPricing && (
                  <>
                    {' '}Pour {formatEUR(Number(form.dailyPrice))}/j : semaine{' '}
                    {formatEUR(autoPricing.weekPrice)} · mois {formatEUR(autoPricing.monthPrice)}.{' '}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          weekPrice: String(autoPricing.weekPrice),
                          monthPrice: String(autoPricing.monthPrice),
                          tiers: JSON.stringify(autoPricing.tiers),
                        }))
                      }
                    >
                      Remplir maintenant
                    </button>
                  </>
                )}
              </p>
              <div className="field">
                <label>Tarifs dégressifs (JSON : [{'{'}"minDays":1,"perDay":30{'}'}, …])</label>
                <input
                  value={form.tiers}
                  onChange={(e) => set('tiers', e.target.value)}
                  placeholder={
                    autoPricing
                      ? JSON.stringify(autoPricing.tiers)
                      : '[{"minDays":1,"perDay":30},{"minDays":4,"perDay":24}]'
                  }
                />
              </div>
            </>
          )}

          <div className="field">
            <label>Images (glisser-déposer, la 1re est la principale)</label>
            <ImageDropzone value={form.images} onChange={(v) => set('images', v)} />
          </div>

          {isMachine && (
            <fieldset className="card card-body" style={{ margin: 0 }}>
              <legend className="small" style={{ fontWeight: 700 }}>
                Complétez votre location — proposé sur la fiche produit, la borne et l&apos;appli
              </legend>
              <div className="stack" style={{ gap: 14 }}>
                <LinkPicker
                  label="Accessoires nécessaires"
                  hint="ex. rotabuse pour un nettoyeur haute pression"
                  candidates={products.filter((p) => p.kind === 'ACCESSORY' && !p.technical)}
                  value={form.recommendedAccessoryIds}
                  onChange={(v) => set('recommendedAccessoryIds', v)}
                />
                <LinkPicker
                  label="Consommables"
                  hint="ex. disques diamant pour une disqueuse, mèches SDS+ pour un perforateur"
                  candidates={products.filter((p) => p.kind === 'CONSUMABLE' && !p.technical)}
                  value={form.consumableIds}
                  onChange={(v) => set('consumableIds', v)}
                />
                <LinkPicker
                  label="Équipements de protection (EPI)"
                  hint="ex. masque, lunettes, gants"
                  candidates={products.filter((p) => p.kind === 'PPE' && !p.technical)}
                  value={form.ppeIds}
                  onChange={(v) => set('ppeIds', v)}
                />
                <LinkPicker
                  label="Machines complémentaires"
                  hint="ex. proposer un aspirateur avec une ponceuse"
                  candidates={products.filter(
                    (p) => p.kind === 'MACHINE' && !p.technical && p.slug !== form.slug,
                  )}
                  value={form.complementaryProductIds}
                  onChange={(v) => set('complementaryProductIds', v)}
                />
              </div>
            </fieldset>
          )}

          {isTechnical ? (
            <fieldset className="card card-body" style={{ margin: 0 }}>
              <legend className="small" style={{ fontWeight: 700 }}>
                Interne — référence &amp; fournisseurs (jamais affiché au client)
              </legend>
              <div className="field">
                <label>Référence interne (Bricoloc)</label>
                <input
                  value={form.internalRef}
                  onChange={(e) => set('internalRef', e.target.value)}
                  placeholder="ex. O-0001"
                />
              </div>
              <SupplierList value={form.suppliers} onChange={(v) => set('suppliers', v)} />
              <p className="small muted" style={{ margin: '10px 0 0' }}>
                {editingId ? (
                  <>
                    {current?.totalStock ?? 0} exemplaire{(current?.totalStock ?? 0) > 1 ? 's' : ''}{' '}
                    physique{(current?.totalStock ?? 0) > 1 ? 's' : ''} (n° de série, étiquette QR — une
                    même machine peut en avoir plusieurs, un par exemplaire).{' '}
                    <a
                      href={`/admin/exemplaires?q=${encodeURIComponent(form.name)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Gérer les exemplaires →
                    </a>
                  </>
                ) : (
                  'Les exemplaires physiques (n° de série, étiquette QR — une même machine peut en avoir plusieurs) se gèrent dans Admin → Exemplaires une fois la fiche enregistrée.'
                )}
              </p>

              <div style={{ marginTop: 12 }}>
                <PartnerList value={form.partners} onChange={(v) => set('partners', v)} />
              </div>
            </fieldset>
          ) : isMachine ? null : (
            <fieldset className="card card-body" style={{ margin: 0 }}>
              <legend className="small" style={{ fontWeight: 700 }}>
                Interne — approvisionnement (jamais affiché au client)
              </legend>
              {showStockFields && (
                <div className="field-2">
                  <div className="field">
                    <label>Quantité en stock</label>
                    <input
                      type="number"
                      value={form.stockQty}
                      onChange={(e) => set('stockQty', e.target.value)}
                      placeholder="ex. 40"
                    />
                  </div>
                  <div className="field">
                    <label>Revendeur</label>
                    <input
                      value={form.partSupplier}
                      onChange={(e) => set('partSupplier', e.target.value)}
                      placeholder="Cipac, Lecot, Sanimat…"
                    />
                  </div>
                </div>
              )}
              <div className="field-2">
                <div className="field">
                  <label>Référence fournisseur</label>
                  <input
                    value={form.supplierRef}
                    onChange={(e) => set('supplierRef', e.target.value)}
                    placeholder="ex. 2608900912"
                  />
                </div>
                <div className="field">
                  <label>Lien fiche fournisseur</label>
                  <input
                    value={form.supplierUrl}
                    onChange={(e) => set('supplierUrl', e.target.value)}
                    placeholder="https://www.cipac.be/…"
                  />
                </div>
              </div>
              <div className="field-2">
                <div className="field">
                  <label>Prix d&apos;achat / catalogue fournisseur (HTVA)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.supplierListPrice}
                    onChange={(e) => set('supplierListPrice', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Prix d&apos;achat réel négocié (HTVA)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.purchasePrice}
                    onChange={(e) => set('purchasePrice', e.target.value)}
                  />
                </div>
              </div>
            </fieldset>
          )}

          {isMachine &&
            editingId &&
            (() => {
              const hasVariants = (current?.variants?.length ?? 0) > 0;
              const eligible = products.filter(
                (p) =>
                  p.id !== form.id &&
                  p.kind === 'MACHINE' &&
                  !p.parentProductId &&
                  (!p.variants || p.variants.length === 0),
              );
              return (
                <fieldset className="card card-body" style={{ margin: 0 }}>
                  <legend className="small" style={{ fontWeight: 700 }}>
                    Machines rattachées
                  </legend>
                  <p className="small muted">
                    Le client réserve cette fiche produit ; le stock affiché = somme des exemplaires
                    de toutes les machines ci-dessous (marque/modèle précis, n° de série, fournisseur,
                    accessoires propres).
                  </p>
                  {hasVariants && (
                    <ul className="stack" style={{ gap: 6, margin: '8px 0' }}>
                      {current!.variants!.map((v) => (
                        <li
                          key={v.id}
                          className="row"
                          style={{ justifyContent: 'space-between', gap: 8 }}
                        >
                          <span className="small">
                            {v.brand && <strong>{v.brand} </strong>}
                            {v.model ?? v.name}
                            {v.internalRef ? ` · ${v.internalRef}` : ''} — {v.availableCount}/
                            {v.unitsCount} dispo
                            {v.partners.map((pt, i) =>
                              pt.url ? (
                                <a
                                  key={i}
                                  className="badge"
                                  style={{ marginLeft: 6 }}
                                  href={pt.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={`Réserver chez ${pt.name}${pt.ref ? ` · réf. ${pt.ref}` : ''}`}
                                >
                                  + {pt.name}
                                  {pt.availabilityMode === 'ON_REQUEST' ? ' (sur demande)' : ''} ↗
                                </a>
                              ) : (
                                <span
                                  key={i}
                                  className="badge"
                                  style={{ marginLeft: 6 }}
                                  title={pt.ref ? `Réf. ${pt.ref}` : 'Partenaire de secours'}
                                >
                                  + {pt.name}
                                  {pt.availabilityMode === 'ON_REQUEST' ? ' (sur demande)' : ''}
                                </span>
                              ),
                            )}
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => detachVariant(v.id, v.name)}
                          >
                            Détacher
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="row" style={{ gap: 8 }}>
                    <select
                      value={attachPick}
                      onChange={(e) => setAttachPick(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="">— Rattacher une machine existante —</option>
                      {eligible.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.brand ? ` (${p.brand})` : ''}
                          {p.internalRef ? ` · ${p.internalRef}` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={!attachPick}
                      onClick={async () => {
                        await attachVariant(attachPick, form.id);
                        setAttachPick('');
                      }}
                    >
                      Rattacher
                    </button>
                  </div>
                </fieldset>
              );
            })()}

          {!isTechnical && (
            <label className="row" style={{ gap: 8 }}>
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => set('published', e.target.checked)}
              />
              <span className="small">Publié (visible sur le site, l&apos;appli et la borne)</span>
            </label>
          )}
          {isMachine && (
            <label className="row" style={{ gap: 8 }}>
              <input
                type="checkbox"
                checked={form.isNew}
                onChange={(e) => set('isNew', e.target.checked)}
              />
              <span className="small">Badge « Nouveauté » (accueil, catalogue)</span>
            </label>
          )}
          <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
            {editingId ? 'Enregistrer' : 'Créer'}
          </button>
        </form>
      )}

      <div className="card card-body">
        <p className="small muted" style={{ margin: '0 0 10px' }}>
          Colonne <strong>★ Accueil</strong> : cliquez l’étoile pour mettre une machine en avant dans
          « Ce que louent nos clients » sur la page d’accueil ({featuredIds.length} sélectionnée
          {featuredIds.length > 1 ? 's' : ''}, les 3 premières s’affichent). Rien de coché = repli
          automatique sur les machines les plus louées.
        </p>
        <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            placeholder="Filtrer par nom…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as KindFilter)}>
            {(Object.keys(FILTER_LABELS) as KindFilter[]).map((k) => (
              <option key={k} value={k}>
                {FILTER_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>Nom</th>
                <th title="Mise en avant sur l'accueil (« Ce que louent nos clients »)">★ Accueil</th>
                <th>Type</th>
                <th>Catégorie</th>
                <th>Prix/j</th>
                <th>Caution</th>
                <th>Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <Fragment key={p.id}>
                  <tr>
                    <td>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.image || PLACEHOLDER_IMG}
                        alt=""
                        style={{ width: 36, height: 36, objectFit: 'contain', background: '#f4f4f8', borderRadius: 6 }}
                      />
                    </td>
                    <td>
                      {p.name}
                      {(p.brand || p.model) && (
                        <span className="small muted" style={{ marginLeft: 6 }}>
                          ({[p.brand, p.model].filter(Boolean).join(' ')})
                        </span>
                      )}
                      {p.parentProductId && (
                        <span
                          className="badge"
                          style={{ marginLeft: 8 }}
                          title={`Machine rattachée à ${p.parentProduct?.name ?? '…'}`}
                        >
                          ↳ {p.parentProduct?.name ?? 'fiche produit'}
                        </span>
                      )}
                      {!p.parentProductId && (p.variants?.length ?? 0) > 0 && (
                        <span
                          className="badge"
                          style={{ marginLeft: 8 }}
                          title="Fiche produit : le stock vient de ses machines rattachées"
                        >
                          {p.variants!.length} machine{p.variants!.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {isDuplicate(p) && (
                        <span
                          className="badge badge-warn"
                          style={{ marginLeft: 8 }}
                          title="Un autre produit porte un nom quasi identique"
                        >
                          ⚠ doublon possible
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {p.kind === 'MACHINE' && !p.technical ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={!(p.published ?? true) && !featuredIds.includes(p.id)}
                          title={
                            !(p.published ?? true)
                              ? 'Publiez d’abord ce produit pour le mettre en avant'
                              : featuredIds.includes(p.id)
                                ? 'Retirer de l’accueil'
                                : 'Mettre en avant sur l’accueil'
                          }
                          onClick={() => toggleFeatured(p)}
                          style={{
                            fontSize: '1.1rem',
                            color: featuredIds.includes(p.id) ? 'var(--primary)' : 'var(--border)',
                            padding: '2px 6px',
                          }}
                        >
                          {featuredIds.includes(p.id) ? '★' : '☆'}
                        </button>
                      ) : (
                        <span className="small muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className="badge">
                        {p.technical
                          ? (p.parentProductId ? 'MACHINE' : 'MACHINE (libre)') +
                            (p.partners?.length
                              ? ` · +${p.partners.length} partenaire${p.partners.length > 1 ? 's' : ''}`
                              : '')
                          : p.kind === 'MACHINE'
                            ? 'FICHE PRODUIT'
                            : p.kind}
                      </span>
                    </td>
                    <td>{p.category?.name ?? '—'}</td>
                    <td>{p.technical ? '—' : formatEUR(p.dailyPrice)}</td>
                    <td>{p.technical ? '—' : formatEUR(p.deposit)}</td>
                    <td>{p.totalStock}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => edit(p)}>
                        Modifier
                      </button>
                      {p.kind === 'MACHINE' && !p.technical && (p.variants?.length ?? 0) === 0 && (
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Transformer en machine, avec ou sans fiche produit choisie tout de suite"
                          onClick={() => {
                            setConvertingSlug(convertingSlug === p.slug ? null : p.slug);
                            setConvertTarget('');
                          }}
                        >
                          → Machine
                        </button>
                      )}
                      {p.technical && !p.parentProductId && (
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Rattacher cette machine à une fiche produit"
                          onClick={() => {
                            setConvertingSlug(convertingSlug === p.slug ? null : p.slug);
                            setConvertTarget('');
                          }}
                        >
                          Rattacher
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setMergingSlug(mergingSlug === p.slug ? null : p.slug);
                          setMergeTarget('');
                        }}
                      >
                        Fusionner
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => remove(p)}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                  {convertingSlug === p.slug && (
                    <tr>
                      <td colSpan={9}>
                        <div className="row" style={{ gap: 8, alignItems: 'center', padding: '6px 0' }}>
                          <span className="small">
                            {p.technical ? `Rattacher « ${p.name} » à :` : `Transformer « ${p.name} » en machine de :`}
                          </span>
                          <select value={convertTarget} onChange={(e) => setConvertTarget(e.target.value)}>
                            <option value="">
                              {p.technical ? '— Choisir la fiche produit —' : '— Aucune fiche produit pour l’instant —'}
                            </option>
                            {products
                              .filter((o) => o.kind === 'MACHINE' && !o.parentProductId && !o.technical && o.id !== p.id)
                              .map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                          </select>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={p.technical && !convertTarget}
                            onClick={() =>
                              convertTarget ? convertToTechnical(p, convertTarget) : makeTechnical(p)
                            }
                          >
                            Confirmer
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setConvertingSlug(null)}>
                            Annuler
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {mergingSlug === p.slug && (
                    <tr>
                      <td colSpan={9}>
                        <div className="row" style={{ gap: 8, alignItems: 'center', padding: '6px 0' }}>
                          <span className="small">Fusionner « {p.name} » dans :</span>
                          <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}>
                            <option value="">— Choisir le produit à garder —</option>
                            {products
                              .filter((o) => o.kind === p.kind && o.slug !== p.slug)
                              .map((o) => (
                                <option key={o.slug} value={o.slug}>
                                  {o.name}
                                </option>
                              ))}
                          </select>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={!mergeTarget}
                            onClick={() => merge(p, mergeTarget)}
                          >
                            Confirmer la fusion
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setMergingSlug(null)}>
                            Annuler
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Liste éditable des fournisseurs possibles pour une machine (plusieurs
 * sources d'achat, chacune sa réf./lien/prix). */
function SupplierList({
  value,
  onChange,
}: {
  value: SupplierRow[];
  onChange: (v: SupplierRow[]) => void;
}) {
  const patch = (i: number, p: Partial<SupplierRow>) =>
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="field">
      <label>Fournisseurs (plusieurs sources d&apos;achat possibles)</label>
      {value.length === 0 && (
        <p className="small muted" style={{ margin: '0 0 6px' }}>
          Aucun fournisseur renseigné pour l&apos;instant.
        </p>
      )}
      <div className="stack" style={{ gap: 10 }}>
        {value.map((s, i) => (
          <div key={i} className="card card-body" style={{ padding: 10 }}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                placeholder="Fournisseur (ex. Cipac)"
                value={s.name}
                onChange={(e) => patch(i, { name: e.target.value })}
                style={{ flex: 1, minWidth: 140 }}
              />
              <input
                placeholder="Référence fournisseur"
                value={s.ref}
                onChange={(e) => patch(i, { ref: e.target.value })}
                style={{ flex: 1, minWidth: 140 }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => remove(i)}
                aria-label="Retirer ce fournisseur"
              >
                ✕
              </button>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <input
                placeholder="Lien fiche fournisseur"
                value={s.url}
                onChange={(e) => patch(i, { url: e.target.value })}
                style={{ flex: 2, minWidth: 180 }}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Prix catalogue (HTVA)"
                value={s.listPrice}
                onChange={(e) => patch(i, { listPrice: e.target.value })}
                style={{ flex: 1, minWidth: 140 }}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Prix payé (HTVA)"
                value={s.purchasePrice}
                onChange={(e) => patch(i, { purchasePrice: e.target.value })}
                style={{ flex: 1, minWidth: 140 }}
              />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{ marginTop: 8 }}
        onClick={() => onChange([...value, { ...EMPTY_SUPPLIER }])}
      >
        + Ajouter un fournisseur
      </button>
    </div>
  );
}

/** Liste éditable des partenaires de secours pour une machine (plusieurs
 * possibles — Loiselet, Loxam, un autre loueur — chacun son prix, son
 * assurance, sa réf. et son lien, pour dépanner une commande ou comparer). */
function PartnerList({
  value,
  onChange,
}: {
  value: PartnerRow[];
  onChange: (v: PartnerRow[]) => void;
}) {
  const patch = (i: number, p: Partial<PartnerRow>) =>
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="field">
      <label>Partenaires de secours (dépannage si le stock interne est à sec, ou comparaison de prix)</label>
      {value.length === 0 && (
        <p className="small muted" style={{ margin: '0 0 6px' }}>
          Aucun partenaire renseigné pour l&apos;instant.
        </p>
      )}
      <div className="stack" style={{ gap: 10 }}>
        {value.map((s, i) => {
          const cost = Number(s.costPerDay);
          const realCost = cost > 0 ? cost * (1 + (Number(s.insurancePct) || 0) / 100) : null;
          return (
            <div key={i} className="card card-body" style={{ padding: 10 }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  placeholder="Partenaire (ex. Loiselet)"
                  value={s.name}
                  onChange={(e) => patch(i, { name: e.target.value })}
                  style={{ flex: 1, minWidth: 140 }}
                />
                <select
                  value={s.availabilityMode}
                  onChange={(e) => patch(i, { availabilityMode: e.target.value })}
                  style={{ flex: 1, minWidth: 180 }}
                >
                  <option value="ON_REQUEST">Sur demande (à confirmer)</option>
                  <option value="INSTANT">Toujours disponible</option>
                </select>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => remove(i)}
                  aria-label="Retirer ce partenaire"
                >
                  ✕
                </button>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Son prix / jour (HTVA)"
                  value={s.costPerDay}
                  onChange={(e) => patch(i, { costPerDay: e.target.value })}
                  style={{ flex: 1, minWidth: 140 }}
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="Assurance (%) — voir sa facture"
                  value={s.insurancePct}
                  onChange={(e) => patch(i, { insurancePct: e.target.value })}
                  style={{ flex: 1, minWidth: 160 }}
                />
                <input
                  disabled
                  value={realCost != null ? `${realCost.toFixed(2)} € coût réel/j` : '—'}
                  style={{ flex: 1, minWidth: 140 }}
                />
              </div>
              <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <input
                  placeholder="Sa référence"
                  value={s.ref}
                  onChange={(e) => patch(i, { ref: e.target.value })}
                  style={{ flex: 1, minWidth: 140 }}
                />
                <input
                  placeholder="Lien vers sa fiche"
                  value={s.url}
                  onChange={(e) => patch(i, { url: e.target.value })}
                  style={{ flex: 2, minWidth: 180 }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{ marginTop: 8 }}
        onClick={() => onChange([...value, { ...EMPTY_PARTNER }])}
      >
        + Ajouter un partenaire
      </button>
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        La plupart des loueurs facturent une assurance en plus du prix jour (7 % chez Loiselet,
        ~11 % chez Loxam sur des exemples récents — ça varie). Sans ce %, le prix jour seul
        n&apos;est pas le coût réel. Référence et lien facilitent la réservation par mail.
      </p>
    </div>
  );
}

/** Recherche + ajoute des produits liés (accessoires/consommables/EPI/machines). */
function LinkPicker({
  label,
  hint,
  candidates,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  candidates: ProductDetail[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const selected = value
    .map((id) => candidates.find((c) => c.id === id))
    .filter((c): c is ProductDetail => !!c);
  const options = candidates.filter(
    (c) => !value.includes(c.id) && c.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="field">
      <label>{label}</label>
      <p className="small muted" style={{ margin: '0 0 6px' }}>
        {hint}
      </p>
      {selected.length > 0 && (
        <ul className="stack" style={{ gap: 6, margin: '0 0 8px', padding: 0, listStyle: 'none' }}>
          {selected.map((s) => (
            <li
              key={s.id}
              className="row"
              style={{
                alignItems: 'center',
                gap: 8,
                background: 'var(--surface-2)',
                borderRadius: 8,
                padding: '6px 10px',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.image || PLACEHOLDER_IMG}
                alt=""
                style={{ width: 28, height: 28, objectFit: 'contain', background: '#f4f4f8', borderRadius: 6, flexShrink: 0 }}
              />
              <span style={{ flex: 1 }}>{s.name}</span>
              <span className="small muted">{formatEUR(s.dailyPrice)}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onChange(value.filter((id) => id !== s.id))}
                aria-label={`Retirer ${s.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="row" style={{ gap: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un produit…"
          style={{ flex: 1 }}
        />
      </div>
      {q && (
        <ul
          className="stack"
          style={{
            gap: 2,
            margin: '4px 0 0',
            padding: 0,
            listStyle: 'none',
            maxHeight: 180,
            overflowY: 'auto',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
        >
          {options.length === 0 ? (
            <li className="small muted" style={{ padding: '6px 10px' }}>
              Aucun résultat.
            </li>
          ) : (
            options.slice(0, 20).map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', gap: 8 }}
                  onClick={() => {
                    onChange([...value, o.id]);
                    setQ('');
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={o.image || PLACEHOLDER_IMG}
                    alt=""
                    style={{ width: 24, height: 24, objectFit: 'contain', background: '#f4f4f8', borderRadius: 5, flexShrink: 0 }}
                  />
                  + {o.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
