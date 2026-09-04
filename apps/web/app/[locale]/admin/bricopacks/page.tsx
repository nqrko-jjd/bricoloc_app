'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { staffApi } from '@/lib/staff';
import { formatEUR } from '@bricoloc/shared';

/* eslint-disable @typescript-eslint/no-explicit-any */

type PackRow = {
  id: string;
  slug: string;
  name: string;
  published: boolean;
  dailyPrice: number;
  deposit: number;
  family: string;
  popular: boolean;
  separateTotal: number | null;
  itemCount: number;
  image: string | null;
};

type Component = {
  productId: string;
  slug: string;
  name: string;
  kind: string;
  brand: string | null;
  supplier: string;
  image: string | null;
  dailyPrice: number;
  deposit: number;
  quantity: number;
  role: string;
  why: string;
};

type Conso = { label: string; detail: string; price: number };

type PackDetail = {
  id: string;
  slug: string;
  name: string;
  intro: string;
  published: boolean;
  dailyPrice: number;
  weekPrice: number | null;
  monthPrice: number | null;
  deposit: number;
  family: string;
  level: string | null;
  teamSize: string | null;
  popular: boolean;
  discountPct: number;
  components: Component[];
  consumables: Conso[];
  separateTotal: number;
  suggestedDailyPrice: number;
  suggestedDeposit: number;
};

type Machine = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  brand: string | null;
  image: string | null;
  dailyPrice: number;
  deposit: number;
  published: boolean;
  supplier: string;
};

const FAMILIES = [
  'peinture', 'sols-bois', 'carrelage', 'gros-oeuvre', 'plomberie',
  'electricite', 'jardin', 'nettoyage', 'hauteur', 'manutention', 'autres',
];
const LEVELS = ['facile', 'intermédiaire', 'technique'];

export default function AdminBricoPacks() {
  const [rows, setRows] = useState<PackRow[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [pack, setPack] = useState<PackDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const loadList = useCallback(
    () => staffApi<{ packs: PackRow[] }>('/api/admin/bricopacks').then((r) => setRows(r.packs)),
    [],
  );
  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadPack = useCallback(async (id: string) => {
    setSelId(id);
    setMsg('');
    const r = await staffApi<{ pack: PackDetail }>(`/api/admin/bricopacks/${id}`);
    setPack(r.pack);
  }, []);

  async function createPack() {
    const name = window.prompt('Nom du nouveau BricoPack ?');
    if (!name) return;
    const r = await staffApi<{ pack: PackDetail }>('/api/admin/bricopacks', {
      method: 'POST',
      body: { name },
    });
    await loadList();
    setPack(r.pack);
    setSelId(r.pack.id);
  }

  function patch(p: Partial<PackDetail>) {
    setPack((cur) => (cur ? { ...cur, ...p } : cur));
  }
  function patchComp(i: number, c: Partial<Component>) {
    setPack((cur) =>
      cur ? { ...cur, components: cur.components.map((x, j) => (j === i ? { ...x, ...c } : x)) } : cur,
    );
  }

  const liveSeparate = useMemo(
    () => (pack?.components ?? []).reduce((a, c) => a + c.dailyPrice * c.quantity, 0),
    [pack?.components],
  );
  const liveDepositSuggestion = useMemo(
    () => Math.round((pack?.components ?? []).reduce((a, c) => a + c.deposit * c.quantity, 0)),
    [pack?.components],
  );
  const livePriceSuggestion = pack
    ? Math.max(1, Math.round(liveSeparate * (1 - pack.discountPct)))
    : 0;

  async function save() {
    if (!pack) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await staffApi<{ pack: PackDetail }>(`/api/admin/bricopacks/${pack.id}`, {
        method: 'PUT',
        body: {
          name: pack.name,
          intro: pack.intro,
          published: pack.published,
          dailyPrice: pack.dailyPrice,
          weekPrice: pack.weekPrice,
          monthPrice: pack.monthPrice,
          deposit: pack.deposit,
          family: pack.family,
          level: pack.level,
          teamSize: pack.teamSize,
          popular: pack.popular,
          discountPct: pack.discountPct,
          components: pack.components.map((c) => ({
            productId: c.productId,
            quantity: c.quantity,
            role: c.role,
            why: c.why,
          })),
          consumables: pack.consumables,
        },
      });
      setPack(r.pack);
      await loadList();
      setMsg('✓ Enregistré');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (!pack || !window.confirm(`Dépublier « ${pack.name} » ?`)) return;
    await staffApi(`/api/admin/bricopacks/${pack.id}`, { method: 'DELETE' });
    patch({ published: false });
    await loadList();
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>BricoPacks</h1>
        <button className="btn btn-primary" onClick={createPack}>
          + Nouveau pack
        </button>
      </div>
      <p className="small muted">
        Compose chaque pack avec ses vraies machines : réserver le pack immobilise ces machines
        (et inversement). Le prix et la caution restent modifiables — des suggestions sont
        calculées d’après les machines choisies.
      </p>

      <div className="bp-admin">
        <div className="card card-body bp-admin__list">
          <table className="table table--tight">
            <thead>
              <tr>
                <th>Pack</th>
                <th className="num">Outils</th>
                <th className="num">Prix/j</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => loadPack(r.id)}
                  style={{
                    cursor: 'pointer',
                    background: r.id === selId ? 'var(--surface-2, #f1f1f7)' : undefined,
                  }}
                >
                  <td>
                    {r.name}
                    {!r.published && <span className="badge" style={{ marginLeft: 6 }}>brouillon</span>}
                    {r.popular && <span className="badge" style={{ marginLeft: 6 }}>★</span>}
                    <span className="small muted" style={{ display: 'block' }}>{r.family}</span>
                  </td>
                  <td className="num">{r.itemCount}</td>
                  <td className="num">{formatEUR(r.dailyPrice)}</td>
                  <td className="num">›</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bp-admin__editor">
          {!pack ? (
            <div className="card card-body">
              <p className="muted">Sélectionne un pack pour l’éditer, ou crée-en un nouveau.</p>
            </div>
          ) : (
            <PackEditor
              key={pack.id}
              pack={pack}
              busy={busy}
              msg={msg}
              patch={patch}
              patchComp={patchComp}
              liveSeparate={liveSeparate}
              livePriceSuggestion={livePriceSuggestion}
              liveDepositSuggestion={liveDepositSuggestion}
              onSave={save}
              onUnpublish={unpublish}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PackEditor({
  pack,
  busy,
  msg,
  patch,
  patchComp,
  liveSeparate,
  livePriceSuggestion,
  liveDepositSuggestion,
  onSave,
  onUnpublish,
}: {
  pack: PackDetail;
  busy: boolean;
  msg: string;
  patch: (p: Partial<PackDetail>) => void;
  patchComp: (i: number, c: Partial<Component>) => void;
  liveSeparate: number;
  livePriceSuggestion: number;
  liveDepositSuggestion: number;
  onSave: () => void;
  onUnpublish: () => void;
}) {
  const [pickOpen, setPickOpen] = useState(false);
  const [pickQ, setPickQ] = useState('');
  const [pickRes, setPickRes] = useState<Machine[]>([]);

  useEffect(() => {
    if (!pickOpen) return;
    let cancel = false;
    const id = setTimeout(() => {
      staffApi<{ machines: Machine[] }>(
        `/api/admin/bricopacks/pick/machines?q=${encodeURIComponent(pickQ)}`,
      ).then((r) => {
        if (!cancel) setPickRes(r.machines);
      });
    }, 220);
    return () => {
      cancel = true;
      clearTimeout(id);
    };
  }, [pickOpen, pickQ]);

  const chosen = new Set(pack.components.map((c) => c.productId));

  function addMachine(m: Machine) {
    if (chosen.has(m.id)) return;
    patch({
      components: [
        ...pack.components,
        {
          productId: m.id,
          slug: m.slug,
          name: m.name,
          kind: m.kind,
          brand: m.brand,
          supplier: m.supplier,
          image: m.image,
          dailyPrice: m.dailyPrice,
          deposit: m.deposit,
          quantity: 1,
          role: '',
          why: '',
        },
      ],
    });
  }
  function removeComp(i: number) {
    patch({ components: pack.components.filter((_, j) => j !== i) });
  }

  return (
    <div className="stack">
      {msg && (
        <div className={`alert ${msg.startsWith('✓') ? 'alert-ok' : 'alert-err'}`}>{msg}</div>
      )}

      <div className="card card-body stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={pack.published}
              onChange={(e) => patch({ published: e.target.checked })}
            />
            <strong>{pack.published ? 'Publié' : 'Brouillon'}</strong>
          </label>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={pack.popular}
              onChange={(e) => patch({ popular: e.target.checked })}
            />
            Mis en avant (★)
          </label>
        </div>

        <div className="field">
          <label>Nom</label>
          <input value={pack.name} onChange={(e) => patch({ name: e.target.value })} />
        </div>
        <div className="field">
          <label>Accroche</label>
          <textarea
            rows={2}
            value={pack.intro}
            onChange={(e) => patch({ intro: e.target.value })}
          />
        </div>
        <div className="field-2">
          <div className="field">
            <label>Famille</label>
            <select value={pack.family} onChange={(e) => patch({ family: e.target.value })}>
              {FAMILIES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Niveau</label>
            <select
              value={pack.level ?? ''}
              onChange={(e) => patch({ level: e.target.value || null })}
            >
              <option value="">—</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Équipe (ex. « 1–2 pers. »)</label>
          <input
            value={pack.teamSize ?? ''}
            onChange={(e) => patch({ teamSize: e.target.value || null })}
          />
        </div>
      </div>

      {/* ----------------------- Composition ----------------------- */}
      <div className="card card-body stack">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Machines du pack</h3>
          <button className="btn btn-outline btn-sm" onClick={() => setPickOpen((v) => !v)}>
            {pickOpen ? 'Fermer' : '+ Ajouter une machine'}
          </button>
        </div>

        {pickOpen && (
          <div className="card card-body stack" style={{ background: 'var(--surface-2, #f5f5fa)' }}>
            <input
              placeholder="Rechercher une machine…"
              value={pickQ}
              onChange={(e) => setPickQ(e.target.value)}
              autoFocus
            />
            <div className="bp-pick">
              {pickRes.map((m) => (
                <button
                  key={m.id}
                  className="bp-pick__it"
                  disabled={chosen.has(m.id)}
                  onClick={() => addMachine(m)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.image ? <img src={m.image} alt="" /> : <span className="bp-pick__ph" />}
                  <span className="bp-pick__n">
                    {m.name}
                    <span className="small muted">
                      {' '}
                      {m.brand ?? ''} · {formatEUR(m.dailyPrice)}/j
                      {!m.published && ' · brouillon'}
                      {m.supplier === 'LOISELET' && ' · Loiselet'}
                    </span>
                  </span>
                  <span>{chosen.has(m.id) ? '✓' : '+'}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {pack.components.length === 0 ? (
          <p className="small muted">Aucune machine. Ajoutes-en pour composer le pack.</p>
        ) : (
          <div className="stack">
            {pack.components.map((c, i) => (
              <div key={c.productId} className="bp-comp">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.image ? <img src={c.image} alt="" className="bp-comp__img" /> : <span className="bp-comp__img bp-comp__img--ph" />}
                <div className="bp-comp__body">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <strong>{c.name}</strong>
                    <button className="btn btn-ghost btn-sm" onClick={() => removeComp(i)}>
                      Retirer
                    </button>
                  </div>
                  <span className="small muted">
                    {c.brand ?? ''} · {formatEUR(c.dailyPrice)}/j · caution {formatEUR(c.deposit)}
                    {c.supplier === 'LOISELET' && ' · Loiselet (sur demande)'}
                  </span>
                  <div className="bp-comp__row">
                    <label className="field" style={{ maxWidth: 90 }}>
                      <span className="small">Qté</span>
                      <input
                        type="number"
                        min={1}
                        value={c.quantity}
                        onChange={(e) =>
                          patchComp(i, { quantity: Math.max(1, Number(e.target.value) || 1) })
                        }
                      />
                    </label>
                    <label className="field" style={{ maxWidth: 160 }}>
                      <span className="small">Rôle (ex. DÉCOUPER)</span>
                      <input
                        value={c.role}
                        onChange={(e) => patchComp(i, { role: e.target.value })}
                      />
                    </label>
                    <label className="field" style={{ flex: 1 }}>
                      <span className="small">Pourquoi cette machine</span>
                      <input
                        value={c.why}
                        onChange={(e) => patchComp(i, { why: e.target.value })}
                      />
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ----------------------- Prix ----------------------- */}
      <div className="card card-body stack">
        <h3 style={{ margin: 0 }}>Prix &amp; caution</h3>
        <p className="small muted">
          Location des machines à l’unité : <strong>{formatEUR(liveSeparate)}/j</strong>. Avec une
          remise de{' '}
          <input
            type="number"
            style={{ width: 64 }}
            value={Math.round(pack.discountPct * 100)}
            onChange={(e) =>
              patch({ discountPct: Math.min(90, Math.max(0, Number(e.target.value) || 0)) / 100 })
            }
          />{' '}
          % → suggestion <strong>{formatEUR(livePriceSuggestion)}/j</strong>.
        </p>
        <div className="field-2">
          <div className="field">
            <label>Prix / jour du pack</label>
            <div className="row" style={{ gap: 8 }}>
              <input
                type="number"
                step="0.01"
                value={pack.dailyPrice}
                onChange={(e) => patch({ dailyPrice: Number(e.target.value) || 0 })}
              />
              <button
                className="btn btn-outline btn-sm"
                type="button"
                onClick={() =>
                  patch({
                    dailyPrice: livePriceSuggestion,
                    weekPrice: Math.round(livePriceSuggestion * 4),
                    monthPrice: Math.round(livePriceSuggestion * 12),
                  })
                }
              >
                Appliquer
              </button>
            </div>
          </div>
          <div className="field">
            <label>Caution</label>
            <div className="row" style={{ gap: 8 }}>
              <input
                type="number"
                step="0.01"
                value={pack.deposit}
                onChange={(e) => patch({ deposit: Number(e.target.value) || 0 })}
              />
              <button
                className="btn btn-outline btn-sm"
                type="button"
                onClick={() => patch({ deposit: liveDepositSuggestion })}
              >
                = machines ({formatEUR(liveDepositSuggestion)})
              </button>
            </div>
          </div>
        </div>
        <div className="field-2">
          <div className="field">
            <label>Prix semaine</label>
            <input
              type="number"
              step="0.01"
              value={pack.weekPrice ?? ''}
              onChange={(e) => patch({ weekPrice: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
          <div className="field">
            <label>Prix mois</label>
            <input
              type="number"
              step="0.01"
              value={pack.monthPrice ?? ''}
              onChange={(e) => patch({ monthPrice: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
        </div>
      </div>

      {/* ----------------------- Consommables ----------------------- */}
      <div className="card card-body stack">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Consommables suggérés</h3>
          <button
            className="btn btn-outline btn-sm"
            onClick={() =>
              patch({ consumables: [...pack.consumables, { label: '', detail: '', price: 0 }] })
            }
          >
            + Ligne
          </button>
        </div>
        <p className="small muted">
          Texte libre affiché sur la fiche pack (« pensez à… »). Pas encore lié à de vrais produits.
        </p>
        {pack.consumables.map((c, i) => (
          <div key={i} className="bp-comp__row">
            <input
              placeholder="Libellé"
              value={c.label}
              onChange={(e) =>
                patch({
                  consumables: pack.consumables.map((x, j) =>
                    j === i ? { ...x, label: e.target.value } : x,
                  ),
                })
              }
            />
            <input
              placeholder="Détail"
              value={c.detail}
              onChange={(e) =>
                patch({
                  consumables: pack.consumables.map((x, j) =>
                    j === i ? { ...x, detail: e.target.value } : x,
                  ),
                })
              }
            />
            <input
              type="number"
              step="0.01"
              style={{ maxWidth: 90 }}
              value={c.price}
              onChange={(e) =>
                patch({
                  consumables: pack.consumables.map((x, j) =>
                    j === i ? { ...x, price: Number(e.target.value) || 0 } : x,
                  ),
                })
              }
            />
            <button
              className="btn btn-ghost btn-sm"
              onClick={() =>
                patch({ consumables: pack.consumables.filter((_, j) => j !== i) })
              }
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="row" style={{ gap: 12, position: 'sticky', bottom: 0, background: 'var(--surface, #fff)', padding: '12px 0' }}>
        <button className="btn btn-primary btn-lg" disabled={busy} onClick={onSave}>
          {busy ? '…' : 'Enregistrer'}
        </button>
        <a className="btn btn-ghost" href={`/bricopacks/${pack.slug}`} target="_blank" rel="noreferrer">
          Voir la fiche ↗
        </a>
        {pack.published && (
          <button className="btn btn-ghost" onClick={onUnpublish} style={{ marginLeft: 'auto' }}>
            Dépublier
          </button>
        )}
      </div>
    </div>
  );
}
