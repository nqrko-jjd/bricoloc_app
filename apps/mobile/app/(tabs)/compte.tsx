import { useCallback, useState, type ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { t as ti, currentLocale } from '@/lib/i18n';
import { Screen, H1, P, Card, Button, Badge } from '@/components/ui';
import type { Notif } from '@/lib/types';

const ID_STATUS_HINT: Record<string, { label: string; tone: 'ok' | 'warn' | 'err' | undefined }> = {
  VERIFIED: { label: 'Vérifiée', tone: 'ok' },
  PENDING: { label: 'En attente', tone: 'warn' },
  REJECTED: { label: 'Refusée', tone: 'err' },
  NONE: { label: 'À fournir', tone: undefined },
};

export default function CompteScreen() {
  const { user, logout } = useStore();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [ticketUnread, setTicketUnread] = useState(0);
  const [rentalCount, setRentalCount] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!user) return;
    api<{ notifications: Notif[] }>('/api/account/notifications')
      .then((r) => setUnread(r.notifications.filter((n) => !n.readAt).length))
      .catch(() => {});
    api<{ unread: number }>('/api/account/tickets')
      .then((r) => setTicketUnread(r.unread))
      .catch(() => {});
    api<{ reservations: unknown[] }>('/api/reservations')
      .then((r) => setRentalCount(r.reservations.length))
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
        <Text
          onPress={() => router.push('/staff' as never)}
          style={{
            textAlign: 'center',
            color: C.lightGray,
            fontSize: 12,
            fontWeight: '700',
            paddingVertical: 24,
          }}
        >
          Espace équipe →
        </Text>
      </Screen>
    );

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
  const idHint = ID_STATUS_HINT[user.idDocStatus ?? 'NONE'];

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: C.brico,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: C.white, fontWeight: '900', fontSize: 20 }}>{initials || '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 19, fontWeight: '900', color: C.locDeep, letterSpacing: -0.4 }}>
            {user.firstName} {user.lastName}
          </Text>
          <View style={{ marginTop: 4 }}>
            <Badge text={user.customerType === 'PRO' ? `Pro · ${user.companyName ?? ''}` : 'Particulier'} />
          </View>
        </View>
      </View>

      {rentalCount != null && rentalCount > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: C.surface2,
            borderRadius: 14,
            paddingVertical: 14,
            marginBottom: 20,
          }}
        >
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: C.ink }}>{rentalCount}</Text>
            <Text style={{ fontSize: 11.5, color: C.muted, fontWeight: '600', marginTop: 2 }}>
              location{rentalCount > 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ marginBottom: 20 }} />
      )}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <MenuRow
          icon="calendar-outline"
          label="Mes réservations"
          onPress={() => router.push('/(tabs)/reservations')}
        />
        <MenuRow icon="person-outline" label="Coordonnées" onPress={() => router.push('/compte/coordonnees' as never)} />
        <MenuRow
          icon="card-outline"
          label="Pièce d'identité"
          hint={idHint.label}
          hintTone={idHint.tone}
          onPress={() => router.push('/compte/identite' as never)}
        />
        <MenuRow
          icon="chatbubbles-outline"
          label="Mes demandes"
          hint={ticketUnread > 0 ? `${ticketUnread} réponse${ticketUnread > 1 ? 's' : ''}` : undefined}
          hintTone="warn"
          onPress={() => router.push('/compte/tickets' as never)}
        />
        <MenuRow
          icon="notifications-outline"
          label="Notifications"
          hint={unread > 0 ? String(unread) : undefined}
          hintTone="warn"
          onPress={() => router.push('/compte/notifications' as never)}
        />
        <MenuRow
          icon="language-outline"
          label={ti('account.language')}
          hint={currentLocale().toUpperCase()}
          onPress={() => router.push('/compte/langue' as never)}
        />
        <MenuRow
          icon="help-circle-outline"
          label="Aide & assistance"
          last
          onPress={() => router.push('/compte/aide' as never)}
        />
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

function MenuRow({
  icon,
  label,
  hint,
  hintTone,
  last,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  hint?: string;
  hintTone?: 'warn' | 'ok' | 'err';
  last?: boolean;
  onPress: () => void;
}) {
  const hintColor = hintTone === 'warn' ? C.warn : hintTone === 'err' ? C.err : hintTone === 'ok' ? C.ok : C.muted;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: C.border,
        backgroundColor: pressed ? C.surface2 : 'transparent',
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: C.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={17} color={C.brico} />
      </View>
      <Text style={{ flex: 1, fontWeight: '700', color: C.ink, fontSize: 14.5 }}>{label}</Text>
      {hint ? <Text style={{ color: hintColor, fontWeight: '700', fontSize: 13 }}>{hint}</Text> : null}
      <Ionicons name="chevron-forward" size={17} color={C.muted} />
    </Pressable>
  );
}
