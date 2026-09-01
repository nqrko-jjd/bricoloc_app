import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { C } from '@/lib/theme';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';

function Icon({ label, color }: { label: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{label}</Text>;
}

export default function TabsLayout() {
  const { cart } = useStore();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.brico,
        tabBarInactiveTintColor: C.lightGray,
        headerStyle: { backgroundColor: C.loc },
        headerTintColor: C.white,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab.home'),
          tabBarIcon: ({ color }) => <Icon label="🛠️" color={color} />,
        }}
      />
      <Tabs.Screen
        name="panier"
        options={{
          title: t('tab.cart'),
          tabBarBadge: cart && cart.itemCount > 0 ? cart.itemCount : undefined,
          tabBarIcon: ({ color }) => <Icon label="🛒" color={color} />,
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: t('tab.reservations'),
          tabBarIcon: ({ color }) => <Icon label="🎫" color={color} />,
        }}
      />
      <Tabs.Screen
        name="compte"
        options={{
          title: t('tab.account'),
          tabBarIcon: ({ color }) => <Icon label="👤" color={color} />,
        }}
      />
    </Tabs>
  );
}
