import { useCallback, useState } from 'react';
import { RefreshControl, Text, View, Pressable } from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { formatEUR, formatDateBE } from '@/lib/format';
import { Screen, H1, P, Card, Button, Badge } from '@/components/ui';
import type { Reservation } from '@/lib/types';

const STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'neutral' | 'err' }> = {
  CONFIRMED: { label: 'Confirmée', tone: 'ok' },
  PREPARING: { label: 'En préparation', tone: 'warn' },
  READY: { label: 'Prête', tone: 'ok' },
  OUT: { label: 'En location', tone: 'neutral' },
  RETURN_PENDING: { label: 'Retour attendu', tone: 'warn' },
  CLOSED: { label: 'Clôturée', tone: 'ok' },
  CANCELLED: { label: 'Annulée', tone: 'err' },
  DRAFT: { label: 'Brouillon', tone: 'warn' },
};

export default function ReservationsScreen() {
  const { user } = useStore();
  const router = useRouter();
  const [rows, setRows] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!user) return;
    setLoading(true);
    api<{ reservations: Reservation[] }>('/api/reservations')
      .then((r) => setRows(r.reservations))
      .finally(() => setLoading(false));
  }, [user]);

  useFocusEffect(load);

  if (!user)
    return (
      <Screen>
        <H1>Mes réservations</H1>
        <P muted>Connectez-vous pour retrouver vos réservations, QR codes et factures.</P>
        <Button title="Se connecter" onPress={() => router.push('/login')} />
      </Screen>
    );

  return (
    <Screen refreshing={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <H1>Mes réservations</H1>
      {rows.length === 0 && <P muted>Aucune réservation pour le moment.</P>}
      {rows.map((r) => (
        <Link key={r.id} href={`/reservation/${r.id}`} asChild>
          <Pressable>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '800', color: C.loc }}>{r.number}</Text>
                <Badge text={STATUS[r.status]?.label ?? r.status} tone={STATUS[r.status]?.tone ?? 'neutral'} />
              </View>
              <Text style={{ color: C.lightGray, fontSize: 12, marginTop: 4 }}>
                {formatDateBE(r.periodStart)} → {formatDateBE(r.periodEnd)} ·{' '}
                {r.fulfilmentMode === 'DELIVERY' ? 'Livraison' : 'Retrait'} ·{' '}
                {formatEUR(r.totals.totalTVAC)}
              </Text>
              <Text style={{ fontSize: 13, marginTop: 4 }} numberOfLines={1}>
                {r.items.map((i) => `${i.quantity}× ${i.nameSnapshot}`).join(' · ')}
              </Text>
            </Card>
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}
