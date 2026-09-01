import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { Screen, H1, Card, Button, Field } from '@/components/ui';

export default function LoginScreen() {
  const { login } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState('client@bricoloc.example');
  const [password, setPassword] = useState('bricoloc');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Screen>
      <H1>Connexion</H1>
      <Card>
        {err ? <Text style={{ color: C.err, marginBottom: 8 }}>{err}</Text> : null}
        <Field
          label="E-mail"
          value={email}
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
        />
        <Field label="Mot de passe" value={password} secureTextEntry onChangeText={setPassword} />
        <Button
          title="Se connecter"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            setErr('');
            try {
              await login(email.trim(), password);
              router.back();
            } catch (e) {
              setErr(e instanceof Error ? e.message : 'Connexion impossible');
            } finally {
              setBusy(false);
            }
          }}
        />
        <Link href="/register" style={{ color: C.loc, fontWeight: '700', marginTop: 8 }}>
          Créer un compte →
        </Link>
      </Card>
    </Screen>
  );
}
