import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { staffApi } from '@/lib/staff';
import { C } from '@/lib/theme';
import { StaffScreen, ListRow } from '@/components/staff/kit';
import { ScanInput } from '@/components/staff/ScanInput';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function StaffRepairs() {
  const [units, setUnits] = useState<any[]>([]);

  const load = useCallback(async () => {
    const r = await staffApi<{ units: any[] }>('/api/admin/units');
    setUnits(r.units);
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onScan(code: string) {
    try {
      const r: any = await staffApi(`/api/ops/resolve/${encodeURIComponent(code)}`);
      if (r.type === 'unit') router.push(`/staff/unit/${r.id}` as any);
    } catch {
      /* ignore */
    }
  }

  const groups: { title: string; list: any[] }[] = [
    { title: 'À réparer', list: units.filter((u) => u.state === 'DAMAGED') },
    { title: 'En réparation / entretien', list: units.filter((u) => u.state === 'MAINTENANCE') },
    {
      title: 'Entretien à prévoir (14 j)',
      list: units.filter(
        (u) =>
          u.state === 'AVAILABLE' &&
          u.nextMaintenanceAt &&
          new Date(u.nextMaintenanceAt).getTime() < Date.now() + 14 * 86_400_000,
      ),
    },
  ];

  return (
    <StaffScreen title="Réparations">
      <ScanInput onScan={onScan} hint="Scanner un exemplaire" />
      {groups.map((g) => (
        <View key={g.title} style={{ marginTop: 8 }}>
          <Text style={{ fontWeight: '900', color: C.ink, fontSize: 16, marginBottom: 4 }}>
            {g.title} <Text style={{ color: C.muted }}>({g.list.length})</Text>
          </Text>
          {g.list.length === 0 ? (
            <Text style={{ color: C.muted, paddingVertical: 8 }}>—</Text>
          ) : (
            g.list.map((u) => (
              <ListRow
                key={u.id}
                image={u.product?.images?.[0] ?? null}
                title={u.assetTag}
                subtitle={
                  u.product?.name +
                  (u.storageLocation ? ` · 📍 ${u.storageLocation}` : '') +
                  (u.immobilisedUntil
                    ? ` · jusqu’au ${new Date(u.immobilisedUntil).toLocaleDateString('fr-BE')}`
                    : '')
                }
                onPress={() => router.push(`/staff/unit/${u.id}` as any)}
              />
            ))
          )}
        </View>
      ))}
    </StaffScreen>
  );
}
