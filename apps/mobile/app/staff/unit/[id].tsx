import { useCallback, useState } from 'react';
import { Image, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { staffApi } from '@/lib/staff';
import { mediaUrl } from '@/lib/api';
import { C, R } from '@/lib/theme';
import { StaffScreen, BigButton, Pill } from '@/components/staff/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATE: Record<string, { label: string; tone: 'ok' | 'warn' | 'err' | 'muted' }> = {
  AVAILABLE: { label: 'Disponible', tone: 'ok' },
  RENTED: { label: 'En location', tone: 'muted' },
  MAINTENANCE: { label: 'En réparation / entretien', tone: 'warn' },
  DAMAGED: { label: 'Endommagé', tone: 'err' },
  RETIRED: { label: 'Hors service', tone: 'err' },
};

export default function StaffUnit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [unit, setUnit] = useState<any>(null);
  const [loc, setLoc] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState(false);
  const [dmg, setDmg] = useState<string | null>(null);

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

  async function saveLoc() {
    if ((unit?.storageLocation ?? '') === loc.trim()) return;
    await staffApi(`/api/admin/units/${id}`, { method: 'PATCH', body: { storageLocation: loc } });
    setFlash(`Emplacement enregistré`);
    await load();
  }

  async function toService() {
    setBusy(true);
    try {
      await staffApi(`/api/admin/units/${id}`, { method: 'PATCH', body: { state: 'AVAILABLE' } });
      setFlash('Remis en service ✓');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toMaintenance(type: 'REPARATION' | 'ENTRETIEN') {
    setBusy(true);
    try {
      await staffApi(`/api/admin/units/${id}/maintenance`, {
        method: 'POST',
        body: {
          type,
          description: type === 'REPARATION' ? 'Réparation atelier' : 'Entretien / contrôle',
          blocksAvailability: true,
        },
      });
      await staffApi(`/api/admin/units/${id}`, { method: 'PATCH', body: { state: 'MAINTENANCE' } });
      setFlash(type === 'REPARATION' ? 'Envoyé en réparation ✓' : 'Placé en entretien ✓');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function reportDamage() {
    setBusy(true);
    try {
      await staffApi(`/api/admin/units/${id}/damage`, {
        method: 'POST',
        body: { description: (dmg || '').trim() || 'Dommage constaté', feeHT: 0 },
      });
      await staffApi(`/api/admin/units/${id}`, { method: 'PATCH', body: { state: 'DAMAGED' } });
      setFlash('Dommage signalé ✓');
      setDmg(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toRetired() {
    setBusy(true);
    try {
      await staffApi(`/api/admin/units/${id}`, { method: 'PATCH', body: { state: 'RETIRED' } });
      setFlash('Sorti du parc ✓');
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!unit) return <StaffScreen title="Exemplaire">{null}</StaffScreen>;

  const st = STATE[unit.state] ?? { label: unit.state, tone: 'muted' as const };

  return (
    <StaffScreen title={unit.assetTag}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <Image
          source={{ uri: mediaUrl(unit.product?.images?.[0]) }}
          style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: C.surface2 }}
          resizeMode="contain"
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{unit.product?.name}</Text>
          <View style={{ flexDirection: 'row' }}>
            <Pill text={st.label} tone={st.tone} />
          </View>
        </View>
      </View>

      {flash ? <Text style={{ color: C.ok, fontWeight: '800' }}>{flash}</Text> : null}

      {/* Emplacement */}
      <Text style={{ fontWeight: '800', color: C.ink }}>Emplacement</Text>
      <TextInput
        value={loc}
        onChangeText={setLoc}
        placeholder="R-01-A"
        autoCapitalize="characters"
        placeholderTextColor={C.muted}
        onBlur={saveLoc}
        style={{
          backgroundColor: C.white,
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: R.sm,
          paddingHorizontal: 12,
          paddingVertical: 12,
          fontSize: 16,
        }}
      />

      {/* Accès rapides */}
      <Text style={{ fontWeight: '800', color: C.ink, marginTop: 8 }}>Accès rapides</Text>

      {unit.state !== 'AVAILABLE' && (
        <BigButton label="Réparé — remettre en service" tone="ok" disabled={busy} onPress={toService} />
      )}
      <BigButton
        label="Envoyer en réparation (atelier)"
        tone="outline"
        disabled={busy}
        onPress={() => toMaintenance('REPARATION')}
      />
      <BigButton
        label="Entretien / contrôle"
        tone="outline"
        disabled={busy}
        onPress={() => toMaintenance('ENTRETIEN')}
      />

      {dmg === null ? (
        <BigButton
          label="Signaler un dommage"
          tone="outline"
          disabled={busy}
          onPress={() => setDmg('')}
        />
      ) : (
        <View style={{ gap: 8, borderWidth: 2, borderColor: C.err, borderRadius: 14, padding: 12 }}>
          <TextInput
            value={dmg}
            onChangeText={setDmg}
            placeholder="Décris le dommage (facultatif)"
            placeholderTextColor={C.muted}
            multiline
            style={{
              backgroundColor: C.white,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: R.sm,
              padding: 12,
              minHeight: 64,
              fontSize: 15,
            }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <BigButton label="Annuler" tone="outline" onPress={() => setDmg(null)} />
            </View>
            <View style={{ flex: 1 }}>
              <BigButton label="Confirmer" tone="red" disabled={busy} onPress={reportDamage} />
            </View>
          </View>
        </View>
      )}

      <BigButton label="Sortir du parc (hors service)" tone="outline" disabled={busy} onPress={toRetired} />
    </StaffScreen>
  );
}
