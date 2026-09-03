import { useCallback, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { staffApi } from '@/lib/staff';
import { mediaUrl } from '@/lib/api';
import { C } from '@/lib/theme';
import { StaffScreen, ListRow, Pill } from '@/components/staff/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATE_LABEL: Record<string, string> = {
  AVAILABLE: 'Disponible',
  RENTED: 'En location',
  MAINTENANCE: 'En entretien',
  DAMAGED: 'Endommagé',
  RETIRED: 'Retiré',
};

export default function StaffMachine() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [machine, setMachine] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);

  const load = useCallback(async () => {
    const [s, u] = await Promise.all([
      staffApi<{ machines: any[] }>('/api/admin/stock'),
      staffApi<{ units: any[] }>(`/api/admin/units?productId=${id}`),
    ]);
    setMachine(s.machines.find((m) => m.id === id) ?? null);
    setUnits(u.units);
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!machine) return <StaffScreen title="Machine">{null}</StaffScreen>;

  const locSummary = (() => {
    const m = new Map<string, number>();
    for (const u of units) {
      const k = u.storageLocation || '—';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  })();

  return (
    <StaffScreen title={machine.name}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <Image
          source={{ uri: mediaUrl(machine.image) }}
          style={{ width: 84, height: 84, borderRadius: 14, backgroundColor: C.surface2 }}
          resizeMode="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, color: C.ink }}>
            <Text style={{ color: C.ok, fontWeight: '900' }}>{machine.availableNow} dispo</Text> ·{' '}
            {machine.rented} en location · {machine.maintenance} entretien ·{' '}
            {machine.damaged + machine.retired} HS
          </Text>
          <Text style={{ color: C.muted, marginTop: 2 }}>{machine.total} exemplaires</Text>
        </View>
      </View>

      {units.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {locSummary.map(([loc, n]) => (
            <Text
              key={loc}
              style={{
                backgroundColor: loc === '—' ? C.surface2 : C.lavender,
                color: loc === '—' ? C.muted : C.loc,
                fontWeight: '900',
                fontSize: 14,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              📍 {loc === '—' ? 'sans emplacement' : loc}
              {n > 1 ? ` ×${n}` : ''}
            </Text>
          ))}
        </View>
      )}

      {units.map((u) => (
        <ListRow
          key={u.id}
          title={u.assetTag}
          subtitle={u.storageLocation ? `📍 ${u.storageLocation}` : undefined}
          right={<Pill text={STATE_LABEL[u.state] ?? u.state} tone={u.state === 'AVAILABLE' ? 'ok' : 'muted'} />}
          onPress={() => router.push(`/staff/unit/${u.id}` as any)}
        />
      ))}
    </StaffScreen>
  );
}
