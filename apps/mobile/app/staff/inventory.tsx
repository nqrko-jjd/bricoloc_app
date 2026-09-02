import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { staffApi } from '@/lib/staff';
import { C } from '@/lib/theme';
import { StaffScreen, ListRow, BigButton } from '@/components/staff/kit';
import { ScanInput } from '@/components/staff/ScanInput';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function StaffInventory() {
  const [units, setUnits] = useState<any[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState('');

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

  function onScan(code: string) {
    const up = code.trim().toUpperCase();
    const u = expected.find((x) => x.assetTag.toUpperCase() === up || x.qrToken === code);
    if (!u) {
      setFlash(`« ${code} » : pas un exemplaire disponible`);
      return;
    }
    setSeen((p) => new Set(p).add(u.id));
    setFlash(`${u.assetTag} pointé`);
  }

  const byProd = new Map<string, { name: string; image: string | null; loc: string | null; seen: number; exp: number }>();
  for (const u of expected) {
    const e =
      byProd.get(u.product.id) ??
      { name: u.product.name, image: u.product.images?.[0] ?? null, loc: u.storageLocation ?? null, seen: 0, exp: 0 };
    e.exp++;
    if (seen.has(u.id)) e.seen++;
    byProd.set(u.product.id, e);
  }
  const missing = expected.filter((u) => !seen.has(u.id));

  return (
    <StaffScreen title="Inventaire">
      <ScanInput onScan={onScan} hint="Scanner les exemplaires un par un" />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontWeight: '900', fontSize: 18, color: C.ink }}>
          {seen.size}/{expected.length} pointés
        </Text>
        {seen.size > 0 && (
          <Text style={{ color: C.muted }} onPress={() => setSeen(new Set())}>
            Réinitialiser
          </Text>
        )}
      </View>
      {flash ? <Text style={{ color: C.ok, fontWeight: '700' }}>{flash}</Text> : null}

      {[...byProd.values()]
        .sort((a, b) => (a.loc ?? 'zzz').localeCompare(b.loc ?? 'zzz'))
        .map((p) => (
          <ListRow
            key={p.name}
            image={p.image}
            title={p.name}
            subtitle={p.loc ? `📍 ${p.loc}` : undefined}
            right={
              <Text style={{ fontWeight: '900', color: p.seen === p.exp ? C.ok : C.err }}>
                {p.seen}/{p.exp}
              </Text>
            }
          />
        ))}

      {missing.length > 0 && (
        <View style={{ backgroundColor: C.errBg, borderRadius: 12, padding: 12, marginTop: 10 }}>
          <Text style={{ color: C.err, fontWeight: '800' }}>
            {missing.length} non retrouvé(s)
          </Text>
          <Text style={{ color: C.err, marginTop: 4 }}>
            {missing.slice(0, 15).map((u) => u.assetTag).join(', ')}
            {missing.length > 15 ? '…' : ''}
          </Text>
        </View>
      )}

      <BigButton label="Terminer l’inventaire" tone="outline" onPress={() => setSeen(new Set())} />
    </StaffScreen>
  );
}
