import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useStaff } from '@/lib/staff';
import { TEAM_MODE } from '@/lib/config';
import { C, R } from '@/lib/theme';

function StaffLogin() {
  const { login } = useStaff();
  const [email, setEmail] = useState('comptoir@bricoloc.example');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    setErr('');
    try {
      await login(email.trim(), pw);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Connexion impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.loc, padding: 24, justifyContent: 'center' }}>
      <StatusBar style="light" />
      <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900', marginBottom: 4 }}>
        Espace équipe
      </Text>
      <Text style={{ color: '#c9c8ec', marginBottom: 24 }}>Terminal dépôt BRICOLOC</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="E-mail"
        placeholderTextColor="#9a99c9"
        style={inp}
      />
      <TextInput
        value={pw}
        onChangeText={setPw}
        secureTextEntry
        placeholder="Mot de passe"
        placeholderTextColor="#9a99c9"
        onSubmitEditing={go}
        style={inp}
      />
      {err ? <Text style={{ color: '#ffb3ad', marginBottom: 10 }}>{err}</Text> : null}
      <Pressable
        onPress={go}
        disabled={busy}
        style={{ backgroundColor: C.brico, borderRadius: R.md, paddingVertical: 16, alignItems: 'center' }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Se connecter</Text>
        )}
      </Pressable>
      {!TEAM_MODE && (
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={{ marginTop: 18, alignItems: 'center' }}
        >
          <Text style={{ color: '#c9c8ec' }}>← Retour à l’appli client</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const inp = {
  backgroundColor: '#1a1873',
  color: '#fff',
  borderRadius: R.sm,
  paddingHorizontal: 14,
  paddingVertical: 14,
  fontSize: 16,
  marginBottom: 12,
} as const;

export default function StaffLayout() {
  const { staff, ready } = useStaff();

  if (!ready) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.loc, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </SafeAreaView>
    );
  }
  if (!staff) return <StaffLogin />;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
    </>
  );
}
