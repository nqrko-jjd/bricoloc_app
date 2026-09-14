import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { formatDateTimeBE } from '@/lib/format';
import { Screen, Card, P } from '@/components/ui';
import type { Notif } from '@/lib/types';

export default function NotificationsScreen() {
  const { user } = useStore();
  const [notifs, setNotifs] = useState<Notif[]>([]);

  const load = useCallback(() => {
    if (!user) return;
    api<{ notifications: Notif[] }>('/api/account/notifications')
      .then((r) => setNotifs(r.notifications))
      .catch(() => {});
  }, [user]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const unread = notifs.filter((n) => !n.readAt).length;
  if (!user) return null;

  return (
    <Screen>
      <Card>
        {unread > 0 && (
          <Text
            style={{ color: C.loc, fontWeight: '700', marginBottom: 8 }}
            onPress={async () => {
              await api('/api/account/notifications/read', { method: 'POST' });
              load();
            }}
          >
            Tout marquer comme lu
          </Text>
        )}
        {notifs.length === 0 && <P muted>Aucune notification.</P>}
        {notifs.map((n) => (
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
    </Screen>
  );
}
