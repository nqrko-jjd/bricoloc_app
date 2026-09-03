import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider } from '@/lib/store';
import { StaffProvider, useStaff } from '@/lib/staff';
import { TEAM_MODE } from '@/lib/config';
import { setLocaleOverride, type Locale, LOCALES } from '@/lib/i18n';
import { C } from '@/lib/theme';

/**
 * Au démarrage : si l'appli est en mode équipe, ou si un membre de l'équipe
 * est déjà connecté, on ouvre directement l'espace équipe (pratique sur le
 * Zebra : connexion une seule fois). Ne s'exécute qu'une fois par lancement.
 */
function BootRedirect() {
  const { staff, ready } = useStaff();
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    if (TEAM_MODE || staff) router.replace('/staff');
  }, [ready, staff]);
  return null;
}

export default function RootLayout() {
  useEffect(() => {
    AsyncStorage.getItem('bricoloc_locale').then((l) => {
      if (l && (LOCALES as string[]).includes(l)) setLocaleOverride(l as Locale);
    });
  }, []);

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
        <StaffProvider>
          <StatusBar style="light" />
          <BootRedirect />
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
            <Stack.Screen name="produit/[slug]" options={{ headerShown: false }} />
            <Stack.Screen name="bricopacks" options={{ headerShown: false }} />
            <Stack.Screen name="bricopack/[slug]" options={{ headerShown: false }} />
            <Stack.Screen name="commande" options={{ title: 'Commande' }} />
            <Stack.Screen name="reservation/[id]" options={{ title: 'Réservation' }} />
            <Stack.Screen name="scan" options={{ title: 'Scanner', presentation: 'fullScreenModal', headerShown: false }} />
            <Stack.Screen name="staff" options={{ headerShown: false }} />
          </Stack>
        </StaffProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
