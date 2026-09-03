import { useEffect, useState } from 'react';
import { Image, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { formatEUR } from '@/lib/format';
import { Screen, H1, H2, P, Card, Button, Field, Badge } from '@/components/ui';
import { PeriodPicker } from '@/components/PeriodPicker';
import { AddressField } from '@/components/AddressField';
import { IdStep } from '@/components/IdStep';

type Phase = 'dates' | 'fulfil' | 'account' | 'identity' | 'review' | 'done';

const idOk = (s?: string) => s === 'PENDING' || s === 'VERIFIED';

export default function CommandeScreen() {
  const { cart, user, register, reloadUser, setPeriod, setFulfilment, setToken, reloadCart } =
    useStore();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(cart?.period ? 'fulfil' : 'dates');
  const [mode, setMode] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [addr, setAddr] = useState({ line1: '', postalCode: '', city: '' });
  const [contact, setContact] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
  });
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<{ number: string; qrDataUrl: string; invoiceNumber: string } | null>(null);
  const [points, setPoints] = useState<
    { id: string; name: string; line1: string; postalCode: string; city: string; isMain: boolean; transferHours: number }[]
  >([]);
  const [pointId, setPointId] = useState('');

  useEffect(() => {
    if (phase === 'identity' && idOk(user?.idDocStatus)) setPhase('review');
  }, [phase, user?.idDocStatus]);

  useEffect(() => {
    api<{ pickupPoints?: typeof points }>('/api/public/config')
      .then((c) => {
        const pts = c.pickupPoints ?? [];
        setPoints(pts);
        setPointId(pts.find((p) => p.isMain)?.id ?? pts[0]?.id ?? '');
      })
      .catch(() => undefined);
  }, []);

  if (phase === 'done' && result)
    return (
      <Screen>
        <Card style={{ alignItems: 'center' }}>
          <H1>Réservation confirmée</H1>
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.loc }}>{result.number}</Text>
          <Image
            source={{ uri: result.qrDataUrl }}
            style={{ width: 220, height: 220, marginVertical: 12 }}
          />
          <P muted>Présentez ce QR code au comptoir BRICOLOC.</P>
          <Text style={{ color: C.lightGray }}>Facture : {result.invoiceNumber}</Text>
          <Button title="Voir mes réservations" onPress={() => router.replace('/reservations')} />
          <Button title="Nouvelle location" variant="ghost" onPress={() => router.replace('/')} />
        </Card>
      </Screen>
    );

  if (!cart || cart.items.length === 0)
    return (
      <Screen>
        <H1>Panier vide</H1>
        <Button title="Catalogue" onPress={() => router.push('/')} />
      </Screen>
    );

  async function pay() {
    setBusy(true);
    setErr('');
    try {
      if (mode === 'DELIVERY') {
        const c = await api<{ served: boolean }>('/api/public/delivery/check', {
          method: 'POST',
          body: { postalCode: addr.postalCode },
        });
        if (!c.served) throw new Error(`Code postal ${addr.postalCode} hors zone de livraison.`);
      }
      const checkout = await api<{ reservation: { id: string }; token?: string }>('/api/checkout', {
        method: 'POST',
        body: {
          period: cart?.period,
          fulfilment:
            mode === 'DELIVERY'
              ? { mode, address: { ...addr, country: 'BE' } }
              : { mode, pickupPointId: pointId || undefined },
          acceptTerms: true,
          channel: 'MOBILE',
        },
      });
      if (checkout.token) await setToken(checkout.token);
      const done = await api<{ number: string; qrDataUrl: string; invoiceNumber: string }>(
        '/api/checkout/pay',
        { method: 'POST', body: { reservationId: checkout.reservation.id, outcome: 'success' } },
      );
      setResult(done);
      setPhase('done');
      await reloadCart();
    } catch (e) {
      const anyE = e as { status?: number; payload?: { error?: { code?: string } } };
      if (anyE?.status === 409 && anyE?.payload?.error?.code === 'ID_REQUIRED') {
        await reloadUser();
        setErr('Une copie de votre carte d’identité est nécessaire.');
        setPhase('identity');
      } else {
        setErr(e instanceof Error ? e.message : 'Paiement refusé');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      {err ? (
        <Card style={{ backgroundColor: C.errBg, borderColor: '#f0bcbc' }}>
          <Text style={{ color: C.err }}>{err}</Text>
        </Card>
      ) : null}

      {phase === 'dates' && (
        <Card>
          <H2>1. Vos dates</H2>
          <P muted>Une seule période pour toute la commande.</P>
          <PeriodPicker
            initial={cart.period}
            confirmLabel="Continuer"
            onConfirm={async (p) => {
              await setPeriod(p);
              setPhase('fulfil');
            }}
          />
        </Card>
      )}

      {phase === 'fulfil' && (
        <Card>
          <H2>2. Retrait ou livraison</H2>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <Pressable onPress={() => setMode('PICKUP')} style={chip(mode === 'PICKUP')}>
              <Text style={chipT(mode === 'PICKUP')}>Click &amp; Collect</Text>
            </Pressable>
            <Pressable onPress={() => setMode('DELIVERY')} style={chip(mode === 'DELIVERY')}>
              <Text style={chipT(mode === 'DELIVERY')}>Livraison</Text>
            </Pressable>
          </View>

          {mode === 'PICKUP' && points.length > 1 && (
            <View style={{ gap: 8, marginBottom: 12 }}>
              <Text style={{ fontWeight: '700', color: C.ink }}>Point d’enlèvement</Text>
              {points.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setPointId(p.id)}
                  style={{
                    borderWidth: 1,
                    borderColor: pointId === p.id ? C.loc : C.border,
                    backgroundColor: pointId === p.id ? C.surface2 : C.white,
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <Text style={{ fontWeight: '700', color: C.ink }}>{p.name}</Text>
                  <Text style={{ color: C.muted, fontSize: 12 }}>
                    {p.line1}, {p.postalCode} {p.city}
                  </Text>
                  <Text style={{ color: C.brico, fontSize: 12, marginTop: 2 }}>
                    {p.transferHours > 0
                      ? `Prêt sous ${p.transferHours} h`
                      : 'Prêt en 2 h selon disponibilité'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {mode === 'DELIVERY' && (
            <>
              <AddressField
                value={addr.line1}
                onChangeText={(v) => setAddr({ ...addr, line1: v })}
                onPick={(a) =>
                  setAddr({
                    line1: a.line1,
                    postalCode: a.postalCode || addr.postalCode,
                    city: a.city || addr.city,
                  })
                }
              />
              <Field
                label="Code postal"
                value={addr.postalCode}
                keyboardType="number-pad"
                onChangeText={(v) => setAddr({ ...addr, postalCode: v })}
              />
              <Field
                label="Ville"
                value={addr.city}
                onChangeText={(v) => setAddr({ ...addr, city: v })}
              />
            </>
          )}
          <Button
            title="Continuer"
            onPress={async () => {
              await setFulfilment(
                mode === 'DELIVERY'
                  ? { mode, address: { ...addr, country: 'BE' } }
                  : { mode },
              );
              setPhase(user ? (idOk(user.idDocStatus) ? 'review' : 'identity') : 'account');
            }}
          />
        </Card>
      )}

      {phase === 'account' && (
        <Card>
          <H2>3. Créer votre compte</H2>
          <P muted>Un compte est nécessaire pour louer (contrat, caution, pièce d’identité).</P>
          <Pressable onPress={() => router.push('/login')}>
            <Text style={{ color: C.loc, fontWeight: '700', marginBottom: 8 }}>
              J&apos;ai déjà un compte →
            </Text>
          </Pressable>
          <Field label="Prénom" value={contact.firstName} onChangeText={(v) => setContact({ ...contact, firstName: v })} />
          <Field label="Nom" value={contact.lastName} onChangeText={(v) => setContact({ ...contact, lastName: v })} />
          <Field
            label="E-mail"
            value={contact.email}
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={(v) => setContact({ ...contact, email: v })}
          />
          <Field label="Téléphone" value={contact.phone} keyboardType="phone-pad" onChangeText={(v) => setContact({ ...contact, phone: v })} />
          <Field
            label="Mot de passe (8 car. min.)"
            value={password}
            secureTextEntry
            onChangeText={setPassword}
          />
          <Button
            title="Créer mon compte"
            loading={busy}
            disabled={
              !contact.firstName ||
              !contact.lastName ||
              !contact.email ||
              !contact.phone ||
              password.length < 8
            }
            onPress={async () => {
              setBusy(true);
              setErr('');
              try {
                await register({
                  email: contact.email,
                  password,
                  firstName: contact.firstName,
                  lastName: contact.lastName,
                  phone: contact.phone,
                  customerType: 'PARTICULIER',
                });
                setPhase('identity');
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Création impossible');
              } finally {
                setBusy(false);
              }
            }}
          />
        </Card>
      )}

      {phase === 'identity' && (
        <Card>
          <H2>{user ? '' : '4. '}Pièce d’identité</H2>
          <IdStep
            user={user}
            busy={busy}
            setBusy={setBusy}
            setErr={setErr}
            onDone={async () => {
              await reloadUser();
            }}
          />
          <Button
            title="Continuer"
            disabled={!idOk(user?.idDocStatus)}
            onPress={() => setPhase('review')}
          />
          <Button title="Retour" variant="ghost" onPress={() => setPhase(user ? 'fulfil' : 'account')} />
        </Card>
      )}

      {phase === 'review' && cart.quote && (
        <Card>
          <H2>4. Vérification &amp; paiement</H2>
          {cart.quote.lines.map((l) => (
            <View key={l.productId} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
              <Text style={{ flex: 1 }}>
                {l.quantity}× {l.name}
              </Text>
              <Text>{formatEUR(l.lineHT)}</Text>
            </View>
          ))}
          <View style={{ borderTopWidth: 1, borderColor: C.border, marginTop: 8, paddingTop: 8 }}>
            <Row label="Total TVAC" value={formatEUR(cart.quote.totals.totalTVAC)} bold />
            <Row label="Caution" value={formatEUR(cart.quote.totals.depositsTotal)} muted />
            <Row label="À régler maintenant" value={formatEUR(cart.quote.totals.amountDue)} bold />
          </View>
          <Badge text="Paiement de démonstration — aucun débit réel" tone="warn" />
          <Button title="Payer (mode test)" onPress={pay} loading={busy} />
          <Button title="Retour" variant="ghost" onPress={() => setPhase('identity')} />
        </Card>
      )}
    </Screen>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={{ color: muted ? C.lightGray : C.darkGray, fontWeight: bold ? '800' : '400' }}>{label}</Text>
      <Text style={{ color: bold ? C.loc : C.darkGray, fontWeight: bold ? '800' : '400' }}>{value}</Text>
    </View>
  );
}

const chip = (active: boolean) => ({
  paddingHorizontal: 14,
  paddingVertical: 8,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: active ? C.loc : C.border,
  backgroundColor: active ? C.loc : C.white,
});
const chipT = (active: boolean) => ({ color: active ? C.white : C.darkGray, fontWeight: '700' as const });
