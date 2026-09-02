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
