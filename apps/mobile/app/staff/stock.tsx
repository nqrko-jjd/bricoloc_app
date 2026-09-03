import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { staffApi } from '@/lib/staff';
import { C, R } from '@/lib/theme';
import { StaffScreen, ListRow, Pill } from '@/components/staff/kit';
import { ScanInput } from '@/components/staff/ScanInput';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Machine {
  id: string;
  name: string;
  image: string | null;
  category: string | null;
  total: number;
  availableNow: number;
  rented: number;
  maintenance: number;
  damaged: number;
  retired: number;
}
interface Consumable {
  id: string;
  name: string;
  image: string | null;
  stockQty: number | null;
  partSupplier: string | null;
}

export default function StaffStock() {
  const [tab, setTab] = useState<'machines' | 'consumables'>('machines');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const [s, u] = await Promise.all([
      staffApi<{ machines: Machine[]; consumables: Consumable[] }>('/api/admin/stock'),
      staffApi<{ units: any[] }>('/api/admin/units'),
    ]);
    setMachines(s.machines);
    setConsumables(s.consumables);
    setUnits(u.units);
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const locByProduct = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const u of units) {
      if (!u.storageLocation) continue;
      const arr = m.get(u.product.id) ?? [];
      if (!arr.includes(u.storageLocation)) arr.push(u.storageLocation);
      m.set(u.product.id, arr);
    }
    return m;
  }, [units]);

  async function onScan(code: string) {
    try {
      const r: any = await staffApi(`/api/ops/resolve/${encodeURIComponent(code)}`);
      if (r.type === 'unit') return router.push(`/staff/unit/${r.id}` as any);
      if (r.type === 'product') return router.push(`/staff/machine/${r.id}` as any);
    } catch {
      /* ignore */
    }
  }

  const list = tab === 'machines'
    ? machines.filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase()))
    : consumables.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <StaffScreen title="Stock" scroll={false}>
      <ScanInput onScan={onScan} hint="Scanner une machine ou un exemplaire" />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['machines', 'consumables'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: R.sm,
              backgroundColor: tab === t ? C.loc : C.white,
              borderWidth: 1,
              borderColor: tab === t ? C.loc : C.border,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontWeight: '800', color: tab === t ? '#fff' : C.muted }}>
              {t === 'machines' ? 'Machines' : 'Consommables'}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Filtrer…"
        placeholderTextColor={C.muted}
        style={{
          backgroundColor: C.white,
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: R.sm,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 15,
        }}
      />

      <FlatList
        data={list as any[]}
        keyExtractor={(i) => i.id}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) =>
          tab === 'machines' ? (
            <ListRow
              image={item.image}
              title={item.name}
              subtitle={
                <Text numberOfLines={1}>
                  <Text style={{ color: C.loc, fontWeight: '900' }}>
                    {locByProduct.get(item.id)?.length
                      ? `📍 ${locByProduct.get(item.id)!.join(', ')}`
                      : '📍 sans emplacement'}
                  </Text>
                  {(() => {
                    const extra = [
                      item.rented ? `${item.rented} loc.` : '',
                      item.maintenance ? `${item.maintenance} entr.` : '',
                      item.damaged + item.retired ? `${item.damaged + item.retired} HS` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return extra ? `   ${extra}` : '';
                  })()}
                </Text>
              }
              right={
                <Pill
                  text={`${item.availableNow}/${item.total}`}
                  tone={item.availableNow > 0 ? 'ok' : 'err'}
                />
              }
              onPress={() => router.push(`/staff/machine/${item.id}` as any)}
            />
          ) : (
            <ListRow
              image={item.image}
              title={item.name}
              subtitle={item.partSupplier ?? undefined}
              right={
                <Pill
                  text={item.stockQty != null ? String(item.stockQty) : '—'}
                  tone={(item.stockQty ?? 0) > 0 ? 'ok' : 'warn'}
                />
              }
            />
          )
        }
      />
    </StaffScreen>
  );
}
