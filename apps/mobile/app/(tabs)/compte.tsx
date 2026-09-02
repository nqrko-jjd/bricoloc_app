import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { t as ti, currentLocale, setLocaleOverride, LOCALES } from '@/lib/i18n';
import { formatDateTimeBE } from '@/lib/format';
import { Screen, H1, H2, P, Card, Button, Badge } from '@/components/ui';
import type { Notif } from '@/lib/types';

export default function CompteScreen() {
  const { user, logout } = useStore();
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [lang, setLang] = useState(currentLocale());

  const load = useCallback(() => {
    if (!user) return;
    api<{ notifications: Notif[] }>('/api/account/notifications')
      .then((r) => setNotifs(r.notifications))
      .catch(() => {});
  }, [user]);
  // Le callback de useFocusEffect ne doit rien retourner (sinon = cleanup).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!user)
    return (
      <Screen>
        <H1>Mon compte</H1>
        <P muted>
          Connectez-vous ou créez un compte pour réserver, suivre vos locations et recevoir des
          notifications.
        </P>
        <Button title="Se connecter" onPress={() => router.push('/login')} />
        <Button title="Créer un compte" variant="ghost" onPress={() => router.push('/register')} />
        <Card style={{ marginTop: 20 }}>
          <P muted>Démo : client@bricoloc.example / bricoloc</P>
        </Card>
      </Screen>
    );

  const unread = notifs.filter((n) => !n.readAt).length;

  return (
    <Screen>
      <H1>
        {user.firstName} {user.lastName}
      </H1>
      <Badge text={user.customerType === 'PRO' ? `Pro · ${user.companyName ?? ''}` : 'Particulier'} />

      <Card>
        <H2>Coordonnées</H2>
        <P>{user.email}</P>
        <P>{user.phone}</P>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <H2>Notifications {unread > 0 ? `(${unread})` : ''}</H2>
          {unread > 0 && (
            <Text
              style={{ color: C.loc, fontWeight: '700' }}
              onPress={async () => {
                await api('/api/account/notifications/read', { method: 'POST' });
                load();
              }}
            >
              Tout lire
            </Text>
          )}
        </View>
        {notifs.length === 0 && <P muted>Aucune notification.</P>}
        {notifs.slice(0, 20).map((n) => (
          <View
            key={n.id}
            style={{
              borderLeftWidth: 3,
              borderLeftColor: n.readAt ? C.border : C.brico,
              paddingLeft: 8,
              marginVertical: 4,
            }}
          >
            <Text style={{ fontWeight: '700', color: C.loc }}>{n.title}</Text>
            <Text style={{ fontSize: 13 }}>{n.body}</Text>
            <Text style={{ fontSize: 11, color: C.lightGray }}>{formatDateTimeBE(n.createdAt)}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <H2>{ti('account.language')}</H2>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          {LOCALES.map((l) => (
            <Button
              key={l}
              title={l.toUpperCase()}
              variant={l === lang ? 'primary' : 'ghost'}
              onPress={async () => {
                setLocaleOverride(l);
                setLang(l);
                await AsyncStorage.setItem('bricoloc_locale', l);
              }}
            />
          ))}
        </View>
      </Card>

      <Card>
        <H2>Contacter BRICOLOC</H2>
        <P muted>
          Support &amp; SAV depuis chaque réservation (« Signaler un problème »), ou par téléphone
          au comptoir (coordonnées de démo dans l&apos;administration).
        </P>
      </Card>

      <Button title={ti('common.logout')} variant="ghost" onPress={() => logout()} />

      <Text
        onPress={() => router.push('/staff' as never)}
        style={{
          textAlign: 'center',
          color: C.lightGray,
          fontSize: 12,
          fontWeight: '700',
          paddingVertical: 16,
        }}
      >
        Espace équipe →
      </Text>
    </Screen>
  );
}
