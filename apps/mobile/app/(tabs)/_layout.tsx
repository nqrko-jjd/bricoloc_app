import type { ComponentProps } from 'react';
import { Platform, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { C } from '@/lib/theme';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';

// Icônes trait fin (Feather ≈ Lucide) — aligné sur la démo web /appli-demo.
type FeatherName = ComponentProps<typeof Feather>['name'];
const tabIcon =
  (name: FeatherName) =>
  ({ color }: { color: string }) => <Feather name={name} color={color} size={22} />;

// Bouton panier surélevé au centre de la barre, avec badge du nombre d'articles.
function CartTabIcon() {
  const { cart } = useStore();
  const count = cart?.itemCount ?? 0;
  return (
    <View
      style={{
        position: 'absolute',
        top: -24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: C.brico,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: C.white,
        elevation: 10,
        shadowColor: C.locDeep,
        shadowOpacity: 0.28,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
      }}
    >
      <Feather name="shopping-cart" color={C.white} size={22} />
      {count > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -3,
            right: -3,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            paddingHorizontal: 4,
            backgroundColor: C.ink,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: C.white,
          }}
        >
          <Text style={{ color: C.white, fontSize: 10, fontWeight: '800' }}>{count}</Text>
        </View>
      )}
    </View>
  );
}

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
        name="panier"
        options={{
          title: t('tab.cart'),
          tabBarLabel: () => null,
          tabBarIcon: () => <CartTabIcon />,
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{ title: t('tab.reservations'), tabBarIcon: tabIcon('calendar') }}
      />
      <Tabs.Screen
        name="compte"
        options={{ title: t('tab.account'), tabBarIcon: tabIcon('user') }}
      />
    </Tabs>
  );
}
