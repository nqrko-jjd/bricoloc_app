import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider } from '@/lib/store';
import { C } from '@/lib/theme';

export default function RootLayout() {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as { reservationId?: string };
      if (data?.reservationId) router.push(`/reservation/${data.reservationId}`);
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: C.loc },
            headerTintColor: C.white,
            headerTitleStyle: { fontWeight: '800' },
            contentStyle: { backgroundColor: C.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: 'Connexion' }} />
          <Stack.Screen name="register" options={{ title: 'Créer un compte' }} />
          <Stack.Screen name="produit/[slug]" options={{ title: 'Fiche produit' }} />
          <Stack.Screen name="commande" options={{ title: 'Commande' }} />
          <Stack.Screen name="reservation/[id]" options={{ title: 'Réservation' }} />
        </Stack>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
