import { useCallback, useState } from 'react';
import { Image, Linking, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api, API_URL } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOKEN_KEY } from '@/lib/api';
import { C } from '@/lib/theme';
import { formatEUR, formatDateTimeBE } from '@/lib/format';
import { Screen, H1, H2, P, Card, Button, Badge, Field } from '@/components/ui';
import type { Reservation } from '@/lib/types';

export default function ReservationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<{ reservation: Reservation; qrDataUrl: string } | null>(null);
  const [extendDays, setExtendDays] = useState('2');
  const [problem, setProblem] = useState({ subject: '', message: '' });
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api<{ reservation: Reservation; qrDataUrl: string }>(`/api/reservations/${id}`).then(setData);
  }, [id]);
  useFocusEffect(load);

  if (!data) return <Screen><P>Chargement…</P></Screen>;
  const r = data.reservation;
  const canExtend = ['CONFIRMED', 'READY', 'OUT', 'RETURN_PENDING'].includes(r.status);

  return (
    <Screen>
      <H1>{r.number}</H1>
      <Badge text={r.status} />
      {msg ? (
        <Card style={{ backgroundColor: C.okBg, borderColor: '#b7e0c6' }}>
          <Text style={{ color: C.ok }}>{msg}</Text>
        </Card>
      ) : null}

      <Card style={{ alignItems: 'center' }}>
        <H2>QR code</H2>
        <Image source={{ uri: data.qrDataUrl }} style={{ width: 220, height: 220 }} />
        <Text style={{ color: C.lightGray }}>{r.qrToken}</Text>
        <Text style={{ marginTop: 4 }}>
          {r.fulfilmentMode === 'DELIVERY' ? 'Livraison' : 'Retrait comptoir'}
          {r.slot ? ` · ${r.slot}` : ''}
        </Text>
      </Card>

      <Card>
        <H2>Matériel</H2>
        {r.items.map((i) => (
          <View key={i.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
            <Text style={{ flex: 1 }}>
              {i.quantity}× {i.nameSnapshot}
              {i.kind !== 'CONSUMABLE' ? ` · ${i.billedDays} j` : ''}
            </Text>
            <Text>{formatEUR(i.lineHT)}</Text>
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
          <H2>Prolonger</H2>
          <Field
            label="Jours supplémentaires"
            value={extendDays}
            keyboardType="number-pad"
            onChangeText={setExtendDays}
          />
          <Button
            title="Demander la prolongation"
            onPress={async () => {
              try {
                const newEnd = new Date(
                  new Date(r.periodEnd).getTime() + Number(extendDays) * 86400000,
                ).toISOString();
                const res = await api<{ estimatedExtraTVAC: number }>(
                  `/api/reservations/${r.id}/extend`,
                  { method: 'POST', body: { newEnd } },
                );
                setMsg(
                  `Demande envoyée. Supplément estimé : ${formatEUR(res.estimatedExtraTVAC)} TVAC.`,
                );
              } catch (e) {
                setMsg(e instanceof Error ? e.message : 'Prolongation impossible');
              }
            }}
          />
        </Card>
      )}

      <Card>
        <H2>Signaler un problème</H2>
        <Field label="Sujet" value={problem.subject} onChangeText={(v) => setProblem({ ...problem, subject: v })} />
        <Field
          label="Message"
          value={problem.message}
          multiline
          onChangeText={(v) => setProblem({ ...problem, message: v })}
        />
        <Button
          title="Envoyer"
          variant="outline"
          onPress={async () => {
            await api(`/api/reservations/${r.id}/problem`, { method: 'POST', body: problem });
            setProblem({ subject: '', message: '' });
            setMsg('Signalement transmis à l’équipe BRICOLOC.');
          }}
        />
      </Card>

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
    </Screen>
  );
}
