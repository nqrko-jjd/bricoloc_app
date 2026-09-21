import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { C } from '@/lib/theme';
import { formatDateTimeBE } from '@/lib/format';
import type { TicketMessage, TicketStatus } from '@/lib/types';

const STATUS: Record<TicketStatus, string> = { OPEN: 'Ouvert', IN_PROGRESS: 'En cours', CLOSED: 'Clôturé' };

interface Detail {
  ticket: {
    id: string;
    subject: string;
    status: TicketStatus;
    kind: string;
    reservation: { id: string; number: string; periodEnd: string } | null;
    extension: { status: string; requestedEnd: string } | null;
  };
  messages: TicketMessage[];
}

/** Conversation client ↔ équipe : bulles, envoi en bas, rafraîchie toutes les 15 s. */
export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(() => {
    api<Detail>(`/api/account/tickets/${id}`)
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Conversation introuvable'));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 15_000);
      return () => clearInterval(t);
    }, [load]),
  );

  const count = data?.messages.length ?? 0;
  useEffect(() => {
    if (count > 0) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [count]);

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/account/tickets/${id}/messages`, { method: 'POST', body: { body } });
      setText('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  }

  if (!data)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.white, padding: 20 }} edges={['bottom']}>
        <Text style={{ color: error ? C.err : C.lightGray }}>{error || 'Chargement…'}</Text>
      </SafeAreaView>
    );

  const t = data.ticket;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <View style={{ padding: 16, paddingBottom: 8, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: C.ink }}>{t.subject}</Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: t.status === 'CLOSED' ? C.ok : C.loc,
                backgroundColor: t.status === 'CLOSED' ? C.okBg : C.surface2,
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              {STATUS[t.status]}
            </Text>
          </View>
          {t.reservation && (
            <Pressable onPress={() => router.push(`/reservation/${t.reservation!.id}`)}>
              <Text style={{ color: C.loc, fontWeight: '600', marginTop: 4 }}>Location {t.reservation.number} →</Text>
            </Pressable>
          )}
          {t.extension?.status === 'PENDING' && (
            <Text style={{ marginTop: 6, color: C.warn }}>
              Prolongation demandée jusqu’au {formatDateTimeBE(t.extension.requestedEnd)} — en attente de validation.
            </Text>
          )}
          {t.extension?.status === 'APPROVED' && t.reservation && (
            <Text style={{ marginTop: 6, color: C.ok }}>
              Prolongation acceptée : retour fixé au {formatDateTimeBE(t.reservation.periodEnd)}.
            </Text>
          )}
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
          {data.messages.map((m) => {
            if (m.authorType === 'SYSTEM')
              return (
                <Text key={m.id} style={{ alignSelf: 'center', color: C.lightGray, fontStyle: 'italic', fontSize: 13, textAlign: 'center' }}>
                  {m.body}
                </Text>
              );
            const mine = m.authorType === 'CLIENT';
            return (
              <View
                key={m.id}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '84%',
                  backgroundColor: mine ? C.loc : C.white,
                  borderWidth: mine ? 0 : 1,
                  borderColor: C.border,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 16,
                  borderBottomRightRadius: mine ? 4 : 16,
                  borderBottomLeftRadius: mine ? 16 : 4,
                }}
              >
                <Text style={{ color: mine ? C.white : C.ink, lineHeight: 20 }}>{m.body}</Text>
                <Text style={{ fontSize: 11, marginTop: 4, color: mine ? '#c9c8ec' : C.lightGray }}>
                  {mine ? 'Vous' : (m.authorName ?? 'BRICOLOC')} · {formatDateTimeBE(m.createdAt)}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {error ? <Text style={{ color: C.err, paddingHorizontal: 16 }}>{error}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 8, padding: 12, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.border, alignItems: 'flex-end' }}>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            maxLength={4000}
            placeholder={t.status === 'CLOSED' ? 'Écrire pour rouvrir la conversation…' : 'Votre message à l’équipe…'}
            placeholderTextColor={C.lightGray}
            style={{
              flex: 1,
              maxHeight: 120,
              minHeight: 44,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: C.ink,
              backgroundColor: C.white,
            }}
          />
          <Pressable
            onPress={send}
            disabled={busy || !text.trim()}
            style={{ backgroundColor: C.brico, paddingHorizontal: 18, height: 44, borderRadius: 14, justifyContent: 'center', opacity: busy || !text.trim() ? 0.5 : 1 }}
          >
            <Text style={{ color: C.white, fontWeight: '800' }}>{busy ? '…' : 'Envoyer'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
