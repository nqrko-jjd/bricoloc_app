import { useState } from 'react';
import { Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { Screen, H1, Card, Button, Field } from '@/components/ui';

export default function RegisterScreen() {
  const { register } = useStore();
  const router = useRouter();
  const [f, setF] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    customerType: 'PARTICULIER',
    companyName: '',
    vatNumber: '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  return (
    <Screen>
      <H1>Créer un compte</H1>
      <Card>
        {err ? <Text style={{ color: C.err, marginBottom: 8 }}>{err}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {['PARTICULIER', 'PRO'].map((t) => (
            <Pressable
              key={t}
              onPress={() => set('customerType', t)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: f.customerType === t ? C.loc : C.border,
                backgroundColor: f.customerType === t ? C.loc : C.white,
              }}
            >
              <Text style={{ color: f.customerType === t ? C.white : C.darkGray, fontWeight: '700' }}>
                {t === 'PARTICULIER' ? 'Particulier' : 'Professionnel'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Field label="Prénom" value={f.firstName} onChangeText={(v) => set('firstName', v)} />
        <Field label="Nom" value={f.lastName} onChangeText={(v) => set('lastName', v)} />
        <Field
          label="E-mail"
          value={f.email}
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={(v) => set('email', v)}
        />
        <Field label="Téléphone" value={f.phone} keyboardType="phone-pad" onChangeText={(v) => set('phone', v)} />
        {f.customerType === 'PRO' && (
          <>
            <Field label="Société" value={f.companyName} onChangeText={(v) => set('companyName', v)} />
            <Field label="N° TVA" value={f.vatNumber} onChangeText={(v) => set('vatNumber', v)} />
          </>
        )}
        <Field label="Mot de passe (8 car. min.)" value={f.password} secureTextEntry onChangeText={(v) => set('password', v)} />
        <Button
          title="Créer mon compte"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            setErr('');
            try {
              await register(f);
              router.replace('/(tabs)/compte');
            } catch (e) {
              setErr(e instanceof Error ? e.message : 'Inscription impossible');
            } finally {
              setBusy(false);
            }
          }}
        />
      </Card>
    </Screen>
  );
}
