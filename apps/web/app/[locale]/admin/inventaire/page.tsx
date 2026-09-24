'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { staffApi } from '@/lib/staff';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface UnitRow {
  id: string;
  assetTag: string;
  serialNumber: string | null;
  barcode: string | null;
  qrToken: string;
  state: string;
  storageLocation: string | null;
  product: {
    id: string;
    name: string;
    brand: string | null;
    model: string | null;
    internalRef: string | null;
    images: string[] | null;
  };
}

const STORE = 'bricoloc_inventory_v1';
/** Codes rack saisis à la main : E-03-B, R-03-A1… */
const ZONE_RE = /^([ER]-\d{2}-[A-Z]\d?)$/;
/** États où la machine doit être physiquement au dépôt. */
const IN_SHOP = ['AVAILABLE', 'MAINTENANCE', 'DAMAGED'];

const refOf = (u: UnitRow) => u.product.internalRef ?? u.assetTag;
const nameOf = (u: UnitRow) =>
  u.product.brand && u.product.model ? `${u.product.brand} ${u.product.model}` : u.product.name;

type Tone = 'ok' | 'err' | 'info';

export default function AdminInventaire() {
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [seen, setSeen] = useState<string[]>([]);
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [unknown, setUnknown] = useState<string[]>([]);
  const [pending, setPending] = useState<UnitRow | null>(null);
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ msg: string; tone: Tone } | null>(null);
  const [suggest, setSuggest] = useState<UnitRow[]>([]);
  const [code, setCode] = useState('');
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // État de l'inventaire conservé dans le navigateur (rechargement de page sans perte).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const d = JSON.parse(raw);
        setSeen(d.seen ?? []);
        setMoved(d.moved ?? {});
        setUnknown(d.unknown ?? []);
      }
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ seen, moved, unknown }));
    } catch {
      /* ignore */
    }
  }, [seen, moved, unknown]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await staffApi<{ units: UnitRow[] }>('/api/admin/units');
      setUnits(r.units);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => inputRef.current?.focus(), [loading]);

  const seenSet = useMemo(() => new Set(seen), [seen]);
  const expected = useMemo(() => units.filter((u) => IN_SHOP.includes(u.state)), [units]);
  const missing = useMemo(() => expected.filter((u) => !seenSet.has(u.id)), [expected, seenSet]);

  function say(msg: string, tone: Tone = 'ok') {
    setFlash({ msg, tone });
  }
  const markSeen = (id: string) => setSeen((p) => (p.includes(id) ? p : [...p, id]));

  async function assign(u: UnitRow, zone: string) {
    markSeen(u.id);
    const from = u.storageLocation;
    if ((from ?? '').toUpperCase() === zone) {
      say(`${refOf(u)} · ${nameOf(u)} — déjà en ${zone} ✓`);
      return;
    }
    setUnits((prev) => prev.map((x) => (x.id === u.id ? { ...x, storageLocation: zone } : x)));
    setMoved((m) => ({ ...m, [u.id]: zone }));
    say(`✓ ${refOf(u)} · ${nameOf(u)} rangé en ${zone}${from ? ` (était ${from})` : ''}`);
    try {
      await staffApi(`/api/admin/units/${u.id}`, { method: 'PATCH', body: { storageLocation: zone } });
    } catch {
      say(`${refOf(u)} : emplacement non enregistré (réseau) — réessaie`, 'err');
    }
  }

  function takeUnit(u: UnitRow) {
    setSuggest([]);
    if (activeZone) {
      void assign(u, activeZone);
    } else {
      if (pending && pending.id !== u.id) markSeen(pending.id);
      markSeen(u.id);
      setPending(u);
      say(`${refOf(u)} · ${nameOf(u)} pointée — scanne maintenant son emplacement`, 'info');
    }
  }

  async function onScan(raw: string) {
    const c = raw.trim();
    if (!c) return;
    const up = c.toUpperCase();

    // 1) Emplacement : étiquette BRZ-xxx ou code saisi (E-03-B…)
    let zone: string | null = null;
    const zm = up.match(/^BRZ-(.+)$/);
    if (zm) zone = zm[1];
    else if (ZONE_RE.test(up)) zone = up;

    // 2) Exemplaire : QR, code-barres, n° interne, n° de série
    let u =
      units.find(
        (x) =>
          x.qrToken === c ||
          x.barcode === c ||
          x.assetTag?.toUpperCase() === up ||
          (x.serialNumber && x.serialNumber.toUpperCase() === up),
      ) ?? null;

    // 3) Le serveur sait résoudre d'autres formes (QR complet, lien…)
    if (!zone && !u) {
      try {
        const r: any = await staffApi(`/api/ops/resolve/${encodeURIComponent(c)}`);
        if (r.type === 'zone') zone = r.code;
        else if (r.type === 'unit') u = units.find((x) => x.id === r.id) ?? null;
      } catch {
        /* ignore */
      }
    }

    if (zone) {
      setSuggest([]);
      if (pending) {
        const p = pending;
        setPending(null);
        await assign(p, zone);
      } else {
        setActiveZone(zone);
        say(`Emplacement ${zone} actif — scanne les machines qui s'y trouvent`, 'info');
      }
      return;
    }
    if (u) {
      takeUnit(u);
      return;
    }

    // 4) Recherche libre (O-0160, marque, modèle, n° de série partiel)
    const q = c.toLowerCase();
    const found = units
      .filter((x) =>
        [refOf(x), nameOf(x), x.assetTag, x.serialNumber, x.product.name].some((s) =>
          s?.toLowerCase().includes(q),
        ),
      )
      .slice(0, 12);
    if (found.length === 1) {
      takeUnit(found[0]);
      return;
    }
    if (found.length > 1) {
      setSuggest(found);
      say(`${found.length}+ résultats pour « ${c} » — clique sur la bonne machine`, 'info');
      return;
    }
    setUnknown((p) => (p.includes(c) ? p : [...p, c]));
    say(`« ${c} » : code inconnu (noté dans la liste ci-dessous)`, 'err');
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = code;
    setCode('');
    void onScan(v).finally(() => inputRef.current?.focus());
  }

  function reset() {
    if (!confirm("Effacer le pointage en cours ? Les emplacements déjà enregistrés sur les machines restent.")) return;
    setSeen([]);
    setMoved({});
    setUnknown([]);
    setPending(null);
    setActiveZone(null);
    setFlash(null);
    setSuggest([]);
  }

  function exportMissing() {
    const rows = [['O-', 'Machine', 'N° de série', 'Emplacement', 'État']].concat(
      missing.map((u) => [refOf(u), nameOf(u), u.serialNumber ?? '', u.storageLocation ?? '', u.state]),
    );
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `inventaire-non-retrouves-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  // Avancement par machine (O-XXXX) : pointés / attendus.
  const groups = useMemo(() => {
    const map = new Map<string, { ref: string; name: string; image: string | null; exp: UnitRow[] }>();
    for (const u of expected) {
      const k = u.product.id;
      const g = map.get(k) ?? {
        ref: u.product.internalRef ?? '',
        name: nameOf(u),
        image: u.product.images?.[0] ?? null,
        exp: [],
      };
      g.exp.push(u);
      map.set(k, g);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [expected]);

  const shownGroups = showAll
    ? groups
    : groups.filter((g) => g.exp.some((u) => !seenSet.has(u.id)));
  const tone = flash?.tone === 'err' ? '#b3261e' : flash?.tone === 'info' ? '#3b3b9c' : '#1b7a3a';
  const pct = expected.length ? Math.round((seenSet.size / expected.length) * 100) : 0;
  const seenExpected = expected.length - missing.length;

  return (
    <div className="stack">
      <div className="no-print stack">
        <h1>Inventaire du parc</h1>
        <p className="muted small">
          Pose ton scanner (ou tape le code) dans le champ ci-dessous :{' '}
          <strong>1) scanne la machine</strong> (étiquette QR ou code-barres),{' '}
          <strong>2) scanne son emplacement</strong> (étiquette rack, ou tape « E-03-B »). Chaque
          machine scannée est pointée et son emplacement est enregistré sur-le-champ. Astuce : scanne
          d&apos;abord un rack, puis toutes les machines qui s&apos;y trouvent. Tu peux aussi taper
          « O-0160 » ou un n° de série pour retrouver une machine sans étiquette. Les machines pas
          encore pointées apparaissent en bas : ce sont celles à retrouver (ou à sortir du parc).
        </p>

        <form className="card card-body stack" onSubmit={submit}>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <input
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={
                pending
                  ? `Scanne l'emplacement de ${refOf(pending)}…`
                  : activeZone
                    ? `Emplacement ${activeZone} — scanne une machine…`
                    : 'Scanne une machine (ou un rack)…'
              }
              autoFocus
              autoComplete="off"
              style={{ flex: 1, minWidth: 260, fontSize: '1.15rem', padding: '12px 14px' }}
            />
            <button className="btn btn-primary" type="submit">
              Valider
            </button>
          </div>

          {pending ? (
            <div className="row" style={{ gap: 10, background: '#fff6d6', borderRadius: 8, padding: 10 }}>
              <span style={{ flex: 1 }}>
                <strong>
                  {refOf(pending)} · {nameOf(pending)}
                </strong>
                {pending.serialNumber ? ` · SN ${pending.serialNumber}` : ''}
                <br />
                <span className="small">
                  → scanne maintenant son emplacement
                  {pending.storageLocation ? ` (actuellement : ${pending.storageLocation})` : ''}
                </span>
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPending(null)}>
                Annuler
              </button>
            </div>
          ) : activeZone ? (
            <div className="row" style={{ gap: 10, background: '#ececff', borderRadius: 8, padding: 10 }}>
              <span style={{ flex: 1 }}>
                📍 Emplacement <strong>{activeZone}</strong> actif — chaque machine scannée y est rangée
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActiveZone(null)}>
                Changer d&apos;emplacement
              </button>
            </div>
          ) : null}

          {flash && (
            <div style={{ color: tone, fontWeight: 700 }} role="status">
              {flash.msg}
            </div>
          )}

          {suggest.length > 0 && (
            <div className="stack" style={{ gap: 6 }}>
              {suggest.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={() => {
                    takeUnit(u);
                    inputRef.current?.focus();
                  }}
                >
                  <strong>{refOf(u)}</strong>&nbsp;· {nameOf(u)}
                  {u.serialNumber ? ` · SN ${u.serialNumber}` : ''}
                  {u.storageLocation ? ` · 📍 ${u.storageLocation}` : ''}
                </button>
              ))}
            </div>
          )}
        </form>

        <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '1.2rem' }}>
            {seenExpected}/{expected.length} pointées ({pct} %)
          </strong>
          {Object.keys(moved).length > 0 && (
            <span className="muted">· {Object.keys(moved).length} rangée(s)/déplacée(s)</span>
          )}
          <div style={{ flex: 1 }} />
          <label className="small">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />{' '}
            Afficher aussi les machines complètes
          </label>
          <button className="btn btn-ghost btn-sm" onClick={() => void load()} disabled={loading}>
            Actualiser
          </button>
          <button className="btn btn-ghost btn-sm" onClick={reset}>
            Recommencer le pointage
          </button>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: '#e3e3ea', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: '#1b7a3a' }} />
        </div>
      </div>

      {loading ? (
        <p>
          <span className="spinner" /> Chargement du parc…
        </p>
      ) : (
        <>
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>Pointées</th>
                  <th>Exemplaires</th>
                </tr>
              </thead>
              <tbody>
                {shownGroups.map((g) => {
                  const done = g.exp.filter((u) => seenSet.has(u.id)).length;
                  return (
                    <tr key={g.exp[0].product.id}>
                      <td>
                        <strong style={{ color: '#c8102e' }}>{g.ref}</strong> {g.name}
                      </td>
                      <td style={{ fontWeight: 800, color: done === g.exp.length ? '#1b7a3a' : '#b3261e' }}>
                        {done}/{g.exp.length}
                      </td>
                      <td className="small">
                        {g.exp.map((u, i) => (
                          <span
                            key={u.id}
                            style={{
                              display: 'inline-block',
                              marginRight: 10,
                              opacity: seenSet.has(u.id) ? 0.55 : 1,
                              textDecoration: seenSet.has(u.id) ? 'line-through' : 'none',
                            }}
                          >
                            {u.serialNumber ? `SN ${u.serialNumber}` : `Ex. ${i + 1}`}
                            {' '}
                            <span className="muted">{moved[u.id] ?? u.storageLocation ?? 'sans emplacement'}</span>
                          </span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
                {shownGroups.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">
                      {expected.length === 0
                        ? 'Aucune machine au parc.'
                        : 'Tout le parc est pointé 🎉'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {missing.length > 0 && (
            <div className="card card-body stack">
              <div className="row" style={{ gap: 10 }}>
                <strong style={{ color: '#b3261e' }}>{missing.length} machine(s) non retrouvée(s)</strong>
                <div style={{ flex: 1 }} />
                <button className="btn btn-outline btn-sm" onClick={exportMissing}>
                  Exporter en CSV
                </button>
              </div>
              <p className="small muted">
                Ce sont les exemplaires disponibles / en maintenance / endommagés que tu n&apos;as pas
                encore scannés. Une machine louée ou sur chantier n&apos;est pas comptée ici.
              </p>
              <div className="small">
                {missing.slice(0, 60).map((u) => (
                  <div key={u.id}>
                    <strong>{refOf(u)}</strong> · {nameOf(u)}
                    {u.serialNumber ? ` · SN ${u.serialNumber}` : ''}
                    {u.storageLocation ? ` · 📍 ${u.storageLocation}` : ''}
                  </div>
                ))}
                {missing.length > 60 && <div className="muted">… et {missing.length - 60} autres (voir le CSV)</div>}
              </div>
            </div>
          )}

          {unknown.length > 0 && (
            <div className="card card-body stack">
              <strong>Codes inconnus scannés ({unknown.length})</strong>
              <p className="small muted">
                Ces codes ne correspondent à aucune machine du parc : machine pas encore créée ou étiquette
                d&apos;un autre système. À ajouter dans « Stock &amp; exemplaires ».
              </p>
              <div className="small" style={{ wordBreak: 'break-all' }}>
                {unknown.join(' · ')}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
