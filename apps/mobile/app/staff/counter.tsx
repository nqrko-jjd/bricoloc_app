import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { staffApi } from '@/lib/staff';
import { C } from '@/lib/theme';
import { StaffScreen, ListRow, Pill } from '@/components/staff/kit';
import { ScanInput } from '@/components/staff/ScanInput';

/* eslint-disable @typescript-eslint/no-explicit-any */

const BUCKETS: { key: string; label: string; tone: 'warn' | 'ok' | 'muted' | 'err' }[] = [
  { key: 'toPrepare', label: 'À préparer', tone: 'warn' },
  { key: 'ready', label: 'Prêtes', tone: 'ok' },
  { key: 'out', label: 'Retours aujourd’hui', tone: 'warn' },
  { key: 'overdue', label: 'En retard', tone: 'err' },
  { key: 'ongoing', label: 'Locations en cours', tone: 'muted' },
];

export default function StaffCounter() {
  const [board, setBoard] = useState<Record<string, any[]>>({});

  const load = useCallback(async () => {
    try {
      setBoard(await staffApi('/api/ops/board'));
    } catch {
      /* ignore */
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openFlow(number: string) {
    router.push({ pathname: '/staff/flow/[number]', params: { number } } as never);
  }

  async function onScan(code: string) {
    try {
      const r: any = await staffApi(`/api/ops/resolve/${encodeURIComponent(code)}`);
      if (r.type === 'reservation') return openFlow(r.number);
      if (r.type === 'unit' && r.activeReservation) return openFlow(r.activeReservation.number);
    } catch {
      /* ignore */
    }
  }

  return (
    <StaffScreen title="Comptoir">
      <ScanInput onScan={onScan} hint="Scanner le QR du client" />
      {BUCKETS.map((b) => {
        const rows = board[b.key] ?? [];
        return (
          <View key={b.key} style={{ marginTop: 8 }}>
            <Text style={{ fontWeight: '900', color: C.ink, fontSize: 16, marginBottom: 4 }}>
              {b.label} <Text style={{ color: C.muted }}>({rows.length})</Text>
            </Text>
            {rows.length === 0 ? (
              <Text style={{ color: C.muted, paddingVertical: 6 }}>—</Text>
            ) : (
              rows.map((r) => {
                const dated = ['out', 'overdue', 'ongoing'].includes(b.key) && r.periodEnd;
                const retour = dated
                  ? ` · retour ${new Date(r.periodEnd).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' })}`
                  : '';
                return (
                  <ListRow
                    key={r.id}
                    title={r.number}
                    subtitle={`${r.customer} · ${r.lines} art. · ${r.fulfilmentMode === 'DELIVERY' ? 'Livr.' : 'Retrait'}${r.pickupPoint ? ` · ${r.pickupPoint}` : ''}${retour}`}
                    right={<Pill text={r.status} tone={b.tone} />}
                    onPress={() => openFlow(r.number)}
                  />
                );
              })
            )}
          </View>
        );
      })}
    </StaffScreen>
  );
}
