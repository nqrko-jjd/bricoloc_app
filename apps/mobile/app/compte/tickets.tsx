import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { formatDateTimeBE } from '@/lib/format';
import { Screen, Card, P } from '@/components/ui';
import type { TicketListItem, TicketStatus } from '@/lib/types';

const STATUS: Record<TicketStatus, string> = { OPEN: 'Ouvert', IN_PROGRESS: 'En cours', CLOSED: 'Clôturé' };
const KIND: Record<string, string> = { PROBLEM: 'Problème', EXTENSION: 'Prolongation', QUESTION: 'Question' };

/** « Mes demandes » : problèmes signalés et prolongations, avec réponses de l'équipe. */
export default function TicketsScreen() {
  const { user } = useStore();
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketListItem[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      api<{ tickets: TicketListItem[] }>('/api/account/tickets')
        .then((r) => setTickets(r.tickets))
        .catch(() => setTickets([]));
    }, [user]),
  );

  if (!user) return null;

  return (
    <Screen>
      {tickets === null && <P muted>Chargement…</P>}
      {tickets?.length === 0 && (
        <Card>
          <P muted>
            Aucune demande pour le moment. Un souci sur une machine ? Ouvrez la location concernée puis « Signaler un
            problème » : vous suivrez la réponse de l’équipe ici.
          </P>
        </Card>
      )}
      {tickets?.map((t) => (
        <Pressable key={t.id} onPress={() => router.push(`/ticket/${t.id}` as never)}>
          <Card style={{ borderLeftWidth: t.clientUnread ? 4 : 1, borderLeftColor: t.clientUnread ? C.brico : C.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ flex: 1, fontWeight: '800', color: C.ink }}>{t.subject}</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: t.status === 'CLOSED' ? C.ok : C.loc }}>
                {STATUS[t.status]}
              </Text>
            </View>
            <Text style={{ color: C.lightGray, fontSize: 12, marginTop: 2 }}>
              {KIND[t.kind] ?? t.kind}
              {t.reservation ? ` · ${t.reservation.number}` : ''} · {formatDateTimeBE(t.lastMessageAt)}
              {t.clientUnread ? ' · nouvelle réponse' : ''}
            </Text>
            <Text numberOfLines={2} style={{ marginTop: 4, color: C.ink }}>
              {t.messages[0]?.body ?? t.message}
            </Text>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
