import { useCallback, useState } from 'react';
import { Image, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { staffApi } from '@/lib/staff';
import { mediaUrl } from '@/lib/api';
import { C, R } from '@/lib/theme';
import { StaffScreen, BigButton } from '@/components/staff/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATES: { key: string; label: string; tone: 'navy' | 'ok' | 'outline' }[] = [
  { key: 'AVAILABLE', label: 'Disponible', tone: 'ok' },
  { key: 'MAINTENANCE', label: 'En entretien', tone: 'outline' },
  { key: 'DAMAGED', label: 'Endommagé', tone: 'outline' },
  { key: 'RETIRED', label: 'Retiré du parc', tone: 'outline' },
];

export default function StaffUnit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [unit, setUnit] = useState<any>(null);
  const [loc, setLoc] = useState('');

  const load = useCallback(async () => {
    const r = await staffApi<{ units: any[] }>('/api/admin/units');
    const u = r.units.find((x) => x.id === id) ?? null;
    setUnit(u);
    setLoc(u?.storageLocation ?? '');
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function setState(state: string) {
    await staffApi(`/api/admin/units/${id}`, { method: 'PATCH', body: { state } });
    router.back();
  }
  async function saveLoc() {
    await staffApi(`/api/admin/units/${id}`, { method: 'PATCH', body: { storageLocation: loc } });
    await load();
  }

  if (!unit) return <StaffScreen title="Exemplaire">{null}</StaffScreen>;

  return (
    <StaffScreen title={unit.assetTag}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <Image
          source={{ uri: mediaUrl(unit.product?.images?.[0]) }}
          style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: C.surface2 }}
          resizeMode="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{unit.product?.name}</Text>
          <Text style={{ color: C.muted, marginTop: 2 }}>État : {unit.state}</Text>
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ fontWeight: '800', color: C.ink }}>Emplacement</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={loc}
            onChangeText={setLoc}
            placeholder="R-01-A"
            autoCapitalize="characters"
            placeholderTextColor={C.muted}
            onBlur={saveLoc}
            style={{
              flex: 1,
              backgroundColor: C.white,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: R.sm,
              paddingHorizontal: 12,
              paddingVertical: 12,
              fontSize: 16,
            }}
          />
        </View>
      </View>

      <Text style={{ fontWeight: '800', color: C.ink, marginTop: 8 }}>Changer l’état</Text>
      {STATES.map((s) => (
        <BigButton
          key={s.key}
          label={s.label}
          tone={s.key === unit.state ? 'navy' : s.tone}
          onPress={() => setState(s.key)}
        />
      ))}
    </StaffScreen>
  );
}
