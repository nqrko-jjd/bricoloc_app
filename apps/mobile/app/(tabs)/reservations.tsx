import { useCallback, useState } from 'react';
import { RefreshControl, Text, View, Pressable } from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { formatEUR, formatDateBE } from '@/lib/format';
import { Screen, H1, P, Card, Button } from '@/components/ui';
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

const ACTIVE_STATUSES = new Set(['CONFIRMED', 'PREPARING', 'READY', 'OUT', 'RETURN_PENDING']);

/** Titre relatif façon "Retour demain" — repris de l'exemple, calculé sur de vraies données. */
function relativeReturnLabel(r: Reservation): string | null {
  if (!ACTIVE_STATUSES.has(r.status)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(r.periodEnd);
  end.setHours(0, 0, 0, 0);
  const days = Math.round((end.getTime() - today.getTime()) / 86400000);
  if (days < 0) return 'Retour en retard';
  if (days === 0) return "Retour aujourd'hui";
  if (days === 1) return 'Retour demain';
  return `Retour dans ${days} jours`;
}

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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  // NB : le callback de useFocusEffect ne doit rien retourner (sinon traité
  // comme une fonction de nettoyage). On enveloppe donc `load()`.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
      {rows.map((r) => {
        const relative = relativeReturnLabel(r);
        const itemsLabel = r.items.map((i) => `${i.quantity}× ${i.nameSnapshot}`).join(' · ');
        return (
          <Link key={r.id} href={`/reservation/${r.id}`} asChild>
            <Pressable>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text
                    style={{
                      fontSize: 10.5,
                      fontWeight: '900',
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      color: C.brico,
                    }}
                  >
                    {STATUS[r.status]?.label ?? r.status}
                  </Text>
                  <Text style={{ color: C.lightGray, fontSize: 12, fontWeight: '600' }}>{r.number}</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: C.ink, flex: 1 }} numberOfLines={1}>
                    {relative ?? itemsLabel}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={C.muted} />
                </View>

                {relative ? (
                  <Text style={{ fontSize: 13, color: C.muted, marginTop: 2 }} numberOfLines={1}>
                    {itemsLabel}
                  </Text>
                ) : null}

                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 10,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: C.border,
                  }}
                >
                  <Text style={{ color: C.muted, fontSize: 12.5 }}>
                    {formatDateBE(r.periodStart)} → {formatDateBE(r.periodEnd)} ·{' '}
                    {r.fulfilmentMode === 'DELIVERY' ? 'Livraison' : 'Retrait'}
                  </Text>
                  <Text style={{ fontWeight: '800', color: C.ink, fontSize: 13.5 }}>
                    {formatEUR(r.totals.totalTVAC)}
                  </Text>
                </View>
              </Card>
            </Pressable>
          </Link>
        );
      })}
    </Screen>
  );
}
