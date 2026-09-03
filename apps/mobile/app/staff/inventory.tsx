import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { staffApi } from '@/lib/staff';
import { C, R } from '@/lib/theme';
import { StaffScreen, ListRow, BigButton } from '@/components/staff/kit';
import { ScanInput } from '@/components/staff/ScanInput';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Inventaire + rangement.
 * Parcours normal : on scanne la machine trouvée, puis on scanne l'étiquette
 * du rack où on la pose → emplacement enregistré + machine pointée.
 * Mode rapide : scanner d'abord une étiquette de zone (aucune machine en
 * attente) la rend « active » — ensuite chaque machine scannée y est rangée.
 */
export default function StaffInventory() {
  const [units, setUnits] = useState<any[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<any | null>(null);
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [flash, setFlash] = useState('');
  const [flashTone, setFlashTone] = useState<'ok' | 'err' | 'info'>('ok');

  const load = useCallback(async () => {
    const r = await staffApi<{ units: any[] }>('/api/admin/units');
    setUnits(r.units);
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const expected = useMemo(() => units.filter((u) => u.state === 'AVAILABLE'), [units]);

  function say(msg: string, tone: 'ok' | 'err' | 'info' = 'ok') {
    setFlash(msg);
    setFlashTone(tone);
  }

  function markSeen(id: string) {
    setSeen((p) => new Set(p).add(id));
  }

  async function assign(u: any, zone: string) {
    markSeen(u.id);
    const from = u.storageLocation;
    if ((from ?? '').toUpperCase() === zone) {
      say(`${u.assetTag} déjà en ${zone} ✓`, 'ok');
      return;
    }
    setUnits((prev) => prev.map((x) => (x.id === u.id ? { ...x, storageLocation: zone } : x)));
    setMoved((m) => ({ ...m, [u.id]: zone }));
    say(`✓ ${u.assetTag} rangé en ${zone}${from ? ` (était ${from})` : ''}`, 'ok');
    try {
      await staffApi(`/api/admin/units/${u.id}`, { method: 'PATCH', body: { storageLocation: zone } });
    } catch {
      say(`${u.assetTag} : emplacement non enregistré (réseau)`, 'err');
    }
  }

  async function onScan(code: string) {
    const up = code.trim().toUpperCase();

    // 1) Étiquette de zone ?
    let zone: string | null = null;
    const zm = up.match(/^BRZ-(.+)$/);
    if (zm) zone = zm[1];

    // 2) Exemplaire connu ?
    let u = units.find(
      (x) => x.assetTag?.toUpperCase() === up || x.qrToken === code || x.barcode === code,
    );

    // 3) Sinon demander au serveur (zone sans préfixe, token…)
    if (!zone && !u) {
      try {
        const r: any = await staffApi(`/api/ops/resolve/${encodeURIComponent(code)}`);
        if (r.type === 'zone') zone = r.code;
        else if (r.type === 'unit') u = units.find((x) => x.id === r.id) ?? null;
      } catch {
        /* ignore */
      }
    }

    if (zone) {
      if (pending) {
        const p = pending;
        setPending(null);
        await assign(p, zone);
      } else {
        setActiveZone(zone);
        say(`Zone ${zone} active — scanne les machines à y ranger`, 'info');
      }
      return;
    }

    if (u) {
      if (activeZone) {
        await assign(u, activeZone);
      } else {
        if (pending && pending.id !== u.id) markSeen(pending.id); // la précédente : juste pointée
        setPending(u);
        say(`${u.assetTag} — scanne maintenant la zone où tu la ranges`, 'info');
      }
      return;
    }

    say(`« ${code} » : inconnu`, 'err');
  }

  const byProd = new Map<
    string,
    { name: string; image: string | null; loc: string | null; seen: number; exp: number }
  >();
  for (const u of expected) {
    const e =
      byProd.get(u.product.id) ??
      {
        name: u.product.name,
        image: u.product.images?.[0] ?? null,
        loc: u.storageLocation ?? null,
        seen: 0,
        exp: 0,
      };
    e.exp++;
    if (seen.has(u.id)) e.seen++;
    byProd.set(u.product.id, e);
  }
  const missing = expected.filter((u) => !seen.has(u.id));
  const movedCount = Object.keys(moved).length;
  const flashColor = flashTone === 'err' ? C.err : flashTone === 'info' ? C.loc : C.ok;

  function reset() {
    setSeen(new Set());
    setMoved({});
    setPending(null);
    setActiveZone(null);
    setFlash('');
  }

  return (
    <StaffScreen title="Inventaire">
      <ScanInput onScan={onScan} hint="Scanne une machine, puis son rack" />

      {/* Étape en cours */}
      {pending ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: C.yellowTint,
            borderRadius: R.sm,
            padding: 12,
          }}
        >
          <Ionicons name="scan" size={20} color={C.warn} />
          <Text style={{ flex: 1, fontWeight: '800', color: C.ink }}>
            {pending.assetTag} · {pending.product?.name}
            {'\n'}
            <Text style={{ fontWeight: '600', color: C.warn }}>→ scanne l’étiquette du rack</Text>
          </Text>
          <Text style={{ color: C.brico, fontWeight: '800' }} onPress={() => setPending(null)}>
            Annuler
          </Text>
        </View>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: activeZone ? C.lavender : C.surface2,
            borderRadius: R.sm,
            padding: 12,
          }}
        >
          <Ionicons name="location" size={20} color={activeZone ? C.loc : C.muted} />
          <Text style={{ flex: 1, color: activeZone ? C.loc : C.muted, fontWeight: activeZone ? '800' : '400' }}>
            {activeZone
              ? `Zone ${activeZone} active — chaque machine scannée y est rangée`
              : 'Scanne une machine trouvée, puis son rack'}
          </Text>
          {activeZone && (
            <Text style={{ color: C.brico, fontWeight: '800' }} onPress={() => setActiveZone(null)}>
              Stop
            </Text>
          )}
        </View>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontWeight: '900', fontSize: 18, color: C.ink }}>
          {seen.size}/{expected.length} pointés
          {movedCount > 0 ? `  ·  ${movedCount} rangé(s)` : ''}
        </Text>
        {(seen.size > 0 || movedCount > 0) && (
          <Text style={{ color: C.muted }} onPress={reset}>
            Réinitialiser
          </Text>
        )}
      </View>
      {flash ? <Text style={{ color: flashColor, fontWeight: '700' }}>{flash}</Text> : null}

      {[...byProd.values()]
        .sort((a, b) => (a.loc ?? 'zzz').localeCompare(b.loc ?? 'zzz'))
        .map((p) => (
          <ListRow
            key={p.name}
            image={p.image}
            title={p.name}
            subtitle={p.loc ? `📍 ${p.loc}` : 'sans emplacement'}
            right={
              <Text style={{ fontWeight: '900', color: p.seen === p.exp ? C.ok : C.err }}>
                {p.seen}/{p.exp}
              </Text>
            }
          />
        ))}

      {missing.length > 0 && (
        <View style={{ backgroundColor: C.errBg, borderRadius: 12, padding: 12, marginTop: 10 }}>
          <Text style={{ color: C.err, fontWeight: '800' }}>{missing.length} non retrouvé(s)</Text>
          <Text style={{ color: C.err, marginTop: 4 }}>
            {missing
              .slice(0, 15)
              .map((u) => u.assetTag)
              .join(', ')}
            {missing.length > 15 ? '…' : ''}
          </Text>
        </View>
      )}

      <BigButton label="Terminer l’inventaire" tone="outline" onPress={reset} />
    </StaffScreen>
  );
}
