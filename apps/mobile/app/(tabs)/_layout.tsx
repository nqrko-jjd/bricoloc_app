import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { C } from '@/lib/theme';
import { useStore } from '@/lib/store';

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
          title: 'Catalogue',
          tabBarIcon: ({ color }) => <Icon label="🛠️" color={color} />,
        }}
      />
      <Tabs.Screen
        name="panier"
        options={{
          title: 'Panier',
          tabBarBadge: cart && cart.itemCount > 0 ? cart.itemCount : undefined,
          tabBarIcon: ({ color }) => <Icon label="🛒" color={color} />,
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'Réservations',
          tabBarIcon: ({ color }) => <Icon label="🎫" color={color} />,
        }}
      />
      <Tabs.Screen
        name="compte"
        options={{
          title: 'Compte',
          tabBarIcon: ({ color }) => <Icon label="👤" color={color} />,
        }}
      />
    </Tabs>
  );
}
