import type { ComponentProps } from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { C } from '@/lib/theme';
import { t } from '@/lib/i18n';

// Icônes trait fin (Feather ≈ Lucide) — aligné sur la démo web /appli-demo.
type FeatherName = ComponentProps<typeof Feather>['name'];
const tabIcon =
  (name: FeatherName) =>
  ({ color }: { color: string }) => <Feather name={name} color={color} size={22} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brico,
        tabBarInactiveTintColor: C.muted,
        // Barre flottante arrondie, détachée du bord (look plus moderne).
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: Platform.OS === 'ios' ? 26 : 16,
          height: 62,
          borderRadius: 26,
          borderTopWidth: 0,
          backgroundColor: C.white,
          paddingBottom: 0,
          paddingTop: 0,
          elevation: 12,
          shadowColor: C.locDeep,
          shadowOpacity: 0.16,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
        },
        tabBarItemStyle: { paddingVertical: 8 },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '800' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tab.home'), tabBarIcon: tabIcon('home') }}
      />
      <Tabs.Screen
        name="catalogue"
        options={{ title: t('tab.catalogue'), tabBarIcon: tabIcon('grid') }}
      />
      <Tabs.Screen
        name="reservations"
        options={{ title: t('tab.reservations'), tabBarIcon: tabIcon('calendar') }}
      />
      <Tabs.Screen
        name="compte"
        options={{ title: t('tab.account'), tabBarIcon: tabIcon('user') }}
      />
      <Tabs.Screen name="panier" options={{ href: null, title: t('tab.cart') }} />
    </Tabs>
  );
}
