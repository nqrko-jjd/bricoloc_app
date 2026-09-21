import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { api, API_URL } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOKEN_KEY } from '@/lib/api';
import { C } from '@/lib/theme';
import { icsDataUri } from '@/lib/calendar';
import { formatEUR, formatDateTimeBE } from '@/lib/format';
import { Screen, H1, H2, P, Card, Button, Badge, Field } from '@/components/ui';
import type { Reservation } from '@/lib/types';
import { orderPackItems } from '@/lib/pack';

export default function ReservationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<{ reservation: Reservation; qrDataUrl: string } | null>(null);
  const router = useRouter();
  const [days, setDays] = useState('1');
  const [preview, setPreview] = useState<{ extra: number } | { error: string } | null>(null);
  const [extBusy, setExtBusy] = useState(false);
  const [extMsg, setExtMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [problem, setProblem] = useState({ subject: '', message: '' });
  const [probBusy, setProbBusy] = useState(false);
  const [probMsg, setProbMsg] = useState<{ ok: boolean; text: string; ticketId?: string } | null>(null);
  const [msg, setMsg] = useState('');
  const lock = useRef(false); // verrou synchrone : un double-tap ne peut pas partir deux fois

  const load = useCallback(() => {
    api<{ reservation: Reservation; qrDataUrl: string }>(`/api/reservations/${id}`).then(setData);
  }, [id]);
  useFocusEffect(load);

  const reservationId = data?.reservation.id;
  const dayCount = Math.floor(Number(days));
  const wantedEnd =
    data && dayCount > 0
      ? new Date(new Date(data.reservation.periodEnd).getTime() + dayCount * 86400000).toISOString()
      : null;

  // Chiffre le supplément dès que la durée change (rien n'est enregistré à ce stade).
  useEffect(() => {
    if (!reservationId || !wantedEnd) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const q = await api<{ estimatedExtraTVAC: number }>(`/api/reservations/${reservationId}/extend`, {
          method: 'POST',
          body: { newEnd: wantedEnd, preview: true },
        });
        if (!cancelled) setPreview({ extra: q.estimatedExtraTVAC });
      } catch (e) {
        if (!cancelled) setPreview({ error: e instanceof Error ? e.message : 'Prolongation impossible' });
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [reservationId, wantedEnd]);

  async function requestExtension() {
    if (lock.current || !reservationId || !wantedEnd) return;
    lock.current = true;
    setExtBusy(true);
    setExtMsg(null);
    try {
      await api(`/api/reservations/${reservationId}/extend`, { method: 'POST', body: { newEnd: wantedEnd } });
      load();
      setExtMsg({
        ok: true,
        text: 'Demande envoyée ✓ L’équipe vous répond dans « Mes demandes » et par notification. Votre date de retour actuelle reste valable en attendant.',
      });
    } catch (e) {
      setExtMsg({ ok: false, text: e instanceof Error ? e.message : 'Prolongation impossible' });
    } finally {
      lock.current = false;
      setExtBusy(false);
    }
  }

  async function cancelExtension() {
    if (lock.current || !reservationId) return;
    lock.current = true;
    setExtBusy(true);
    setExtMsg(null);
    try {
      await api(`/api/reservations/${reservationId}/extend/cancel`, { method: 'POST' });
      load();
      setExtMsg({ ok: true, text: 'Demande annulée. Votre date de retour est inchangée.' });
    } catch (e) {
      setExtMsg({ ok: false, text: e instanceof Error ? e.message : 'Annulation impossible' });
    } finally {
      lock.current = false;
      setExtBusy(false);
    }
  }

  async function sendProblem() {
    if (lock.current || !reservationId) return;
    lock.current = true;
    setProbBusy(true);
    setProbMsg(null);
    try {
      const out = await api<{ ticketId: string }>(`/api/reservations/${reservationId}/problem`, {
        method: 'POST',
        body: problem,
      });
      setProblem({ subject: '', message: '' });
      load();
      setProbMsg({ ok: true, text: 'Signalement envoyé ✓ Suivez la réponse de l’équipe dans la conversation.', ticketId: out.ticketId });
    } catch (e) {
      setProbMsg({ ok: false, text: e instanceof Error ? e.message : 'Envoi impossible' });
    } finally {
      lock.current = false;
      setProbBusy(false);
    }
  }

  if (!data) return <Screen><P>Chargement…</P></Screen>;
  const r = data.reservation;
  const canExtend = ['CONFIRMED', 'READY', 'OUT', 'RETURN_PENDING'].includes(r.status);
  const pending = r.extensions?.find((e) => e.status === 'PENDING');

  return (
    <Screen>
      <H1>{r.number}</H1>
      <Badge text={r.status} />
      <Card style={{ alignItems: 'center' }}>
        <H2>QR code</H2>
        <Image source={{ uri: data.qrDataUrl }} style={{ width: 220, height: 220 }} />
        <Text style={{ color: C.lightGray }}>{r.qrToken}</Text>
        <Text style={{ marginTop: 4 }}>
          {r.fulfilmentMode === 'DELIVERY' ? 'Livraison' : 'Retrait comptoir'}
          {r.slot ? ` · ${r.slot}` : ''}
        </Text>
        <Button
          title="📅 Ajouter à mon agenda"
          variant="outline"
          onPress={() =>
            Linking.openURL(
              icsDataUri({
                uid: `resa-${r.number}`,
                start: r.periodStart,
                end: r.periodEnd,
                summary: `Location BRICOLOC ${r.number}`,
                description: `${orderPackItems(r.items)
                  .filter((i) => !i.packRef)
                  .map((i) => `${i.quantity}× ${i.nameSnapshot}`)
                  .join(', ')}. Code : ${r.number}.`,
                location:
                  r.fulfilmentMode === 'DELIVERY'
                    ? 'Livraison'
                    : 'BRICOLOC — Gieterijstraat 49, 1601 Ruisbroek',
              }),
            )
          }
        />
      </Card>

      <Card>
        <H2>Matériel</H2>
        {orderPackItems(r.items).map((i) => (
          <View key={i.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
            <Text style={{ flex: 1, paddingLeft: i.packRef ? 14 : 0, color: i.packRef ? C.lightGray : undefined }}>
              {i.packRef ? '↳ ' : ''}{i.quantity}× {i.nameSnapshot}
              {!i.packRef && i.kind !== 'CONSUMABLE' ? ` · ${i.billedDays} j` : ''}
            </Text>
            <Text style={i.packRef ? { color: C.lightGray, fontSize: 12 } : undefined}>
              {i.packRef ? 'inclus' : formatEUR(i.lineHT)}
            </Text>
          </View>
        ))}
        <Text style={{ color: C.lightGray, fontSize: 12, marginTop: 6 }}>
          {formatDateTimeBE(r.periodStart)} → {formatDateTimeBE(r.periodEnd)}
        </Text>
      </Card>

      <Card>
        <H2>Paiements &amp; caution</H2>
        {r.payments.map((p) => (
          <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: C.lightGray }}>
              {p.kind} — {p.status}
            </Text>
            <Text>{formatEUR(p.amount)}</Text>
          </View>
        ))}
        {r.deposit && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: C.lightGray }}>Caution ({r.deposit.status})</Text>
            <Text>{formatEUR(r.deposit.amount)}</Text>
          </View>
        )}
      </Card>

      {r.invoices.length > 0 && (
        <Card>
          <H2>Factures</H2>
          {r.invoices.map((inv) => (
            <Button
              key={inv.id}
              variant="ghost"
              title={`${inv.number} (${inv.kind}) — ouvrir le PDF`}
              onPress={async () => {
                const t = await AsyncStorage.getItem(TOKEN_KEY);
                Linking.openURL(
                  `${API_URL}/api/reservations/${r.id}/invoices/${inv.id}/pdf?token=${t}`,
                );
              }}
            />
          ))}
        </Card>
      )}

      {canExtend && (
        <Card>
          <H2>Prolonger la location</H2>
          <Text style={{ color: C.ink, marginBottom: 8 }}>
            Retour actuel : <Text style={{ fontWeight: '800' }}>{formatDateTimeBE(r.periodEnd)}</Text>
          </Text>

          {pending && (
            <View
              style={{
                borderWidth: 1,
                borderColor: C.border,
                borderLeftWidth: 4,
                borderLeftColor: C.brico,
                borderRadius: 10,
                padding: 12,
                marginBottom: 12,
                backgroundColor: C.surface2,
              }}
            >
              <Text style={{ fontWeight: '800', color: C.ink }}>Demande en attente de validation</Text>
              <Text style={{ color: C.ink, marginTop: 4 }}>
                Retour souhaité : {formatDateTimeBE(pending.requestedEnd)} · supplément estimé{' '}
                {formatEUR(pending.extraTVAC)} TVAC. Tant que l’équipe n’a pas répondu, votre retour reste fixé au{' '}
                {formatDateTimeBE(r.periodEnd)}.
              </Text>
              {pending.ticketId && (
                <Button
                  title="Voir la conversation"
                  variant="outline"
                  onPress={() => router.push(`/ticket/${pending.ticketId}` as never)}
                />
              )}
              <Button title="Annuler la demande" variant="ghost" onPress={cancelExtension} disabled={extBusy} />
            </View>
          )}

          <Text style={{ fontWeight: '700', color: C.ink, marginBottom: 6 }}>
            {pending ? 'Modifier la durée demandée' : 'Combien de jours en plus ?'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {[1, 2, 3, 7].map((n) => {
              const active = String(n) === days;
              return (
                <Pressable
                  key={n}
                  onPress={() => {
                    setDays(String(n));
                    setExtMsg(null);
                  }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? C.loc : C.border,
                    backgroundColor: active ? C.loc : C.white,
                  }}
                >
                  <Text style={{ fontWeight: '700', color: active ? C.white : C.ink }}>
                    +{n} {n === 7 ? 'jours (1 sem.)' : n === 1 ? 'jour' : 'jours'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Field
            label="Ou un autre nombre de jours"
            value={days}
            keyboardType="number-pad"
            onChangeText={(v) => {
              setDays(v.replace(/\D/g, '').slice(0, 3));
              setExtMsg(null);
            }}
          />
          {wantedEnd && (
            <Text style={{ color: C.ink, marginBottom: 8 }}>
              Nouveau retour : <Text style={{ fontWeight: '800' }}>{formatDateTimeBE(wantedEnd)}</Text>
              {preview
                ? 'extra' in preview
                  ? ` · supplément estimé ${formatEUR(preview.extra)} TVAC (réglé au retour)`
                  : ''
                : ''}
            </Text>
          )}
          {preview && 'error' in preview ? <Text style={{ color: C.err, marginBottom: 8 }}>{preview.error}</Text> : null}
          <Button
            title={extBusy ? 'Envoi en cours…' : pending ? 'Mettre à jour ma demande' : 'Demander la prolongation'}
            onPress={requestExtension}
            loading={extBusy}
            disabled={!wantedEnd || (!!preview && 'error' in preview)}
          />
          {extMsg && (
            <View
              accessibilityLiveRegion="polite"
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 10,
                backgroundColor: extMsg.ok ? C.okBg : C.errBg,
              }}
            >
              <Text style={{ color: extMsg.ok ? C.ok : C.err, fontWeight: '600' }}>{extMsg.text}</Text>
            </View>
          )}
        </Card>
      )}

      <Card>
        <H2>Signaler un problème</H2>
        <P muted>Panne, pièce manquante, question… L’équipe vous répond dans une conversation.</P>
        <Field label="Sujet" value={problem.subject} onChangeText={(v) => setProblem({ ...problem, subject: v })} />
        <Field
          label="Message"
          value={problem.message}
          multiline
          onChangeText={(v) => setProblem({ ...problem, message: v })}
        />
        <Button
          title={probBusy ? 'Envoi en cours…' : 'Envoyer'}
          variant="outline"
          onPress={sendProblem}
          loading={probBusy}
          disabled={!problem.subject.trim() || !problem.message.trim()}
        />
        {probMsg && (
          <View
            accessibilityLiveRegion="polite"
            style={{ marginTop: 10, padding: 12, borderRadius: 10, backgroundColor: probMsg.ok ? C.okBg : C.errBg }}
          >
            <Text style={{ color: probMsg.ok ? C.ok : C.err, fontWeight: '600' }}>{probMsg.text}</Text>
            {probMsg.ticketId && (
              <Text
                style={{ color: C.loc, fontWeight: '800', marginTop: 6 }}
                onPress={() => router.push(`/ticket/${probMsg.ticketId}` as never)}
              >
                Suivre ma demande →
              </Text>
            )}
          </View>
        )}
      </Card>

      {(r.tickets?.length ?? 0) > 0 && (
        <Card>
          <H2>Mes demandes pour cette location</H2>
          {r.tickets!.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => router.push(`/ticket/${t.id}` as never)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, gap: 8 }}
            >
              <Text style={{ flex: 1, color: C.ink, fontWeight: t.clientUnread ? '800' : '500' }}>
                {t.clientUnread ? '● ' : ''}
                {t.subject}
              </Text>
              <Text style={{ color: t.status === 'CLOSED' ? C.ok : C.loc, fontWeight: '700', fontSize: 12 }}>
                {t.status === 'OPEN' ? 'Ouvert' : t.status === 'IN_PROGRESS' ? 'En cours' : 'Clôturé'}
              </Text>
            </Pressable>
          ))}
        </Card>
      )}

      <Button
        title="Recommander ces machines"
        variant="secondary"
        onPress={async () => {
          const rr = await api<{ items: { productId: string; quantity: number }[] }>(
            `/api/reservations/${r.id}/reorder`,
            { method: 'POST' },
          );
          for (const it of rr.items) await api('/api/cart/items', { method: 'POST', body: it });
          setMsg('Machines ajoutées au panier.');
        }}
      />
      {msg ? <Text style={{ color: C.ok, marginTop: 8, textAlign: 'center' }}>{msg}</Text> : null}
    </Screen>
  );
}
