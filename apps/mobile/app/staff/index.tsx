import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStaff, staffApi } from '@/lib/staff';
import { TEAM_MODE } from '@/lib/config';
import { C, R } from '@/lib/theme';
import { ScanInput } from '@/components/staff/ScanInput';

/* eslint-disable @typescript-eslint/no-explicit-any */

const TILES = [
  { key: 'counter', label: 'Comptoir', sub: 'retrait / retour', icon: 'cart', tone: C.loc },
  { key: 'stock', label: 'Stock', sub: 'machines & consommables', icon: 'cube', tone: C.white },
  { key: 'repairs', label: 'Réparations', sub: '& maintenance', icon: 'construct', tone: C.yellowTint },
  { key: 'inventory', label: 'Inventaire', sub: '', icon: 'clipboard', tone: C.white },
] as const;

export default function StaffHome() {
  const { staff, logout } = useStaff();
  const [counts, setCounts] = useState({ counter: 0, repairs: 0 });

  const load = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([
        staffApi<Record<string, any[]>>('/api/ops/board'),
        staffApi<{ machines: any[] }>('/api/admin/stock'),
      ]);
      setCounts({
        counter:
          (b.toPrepare?.length ?? 0) + (b.ready?.length ?? 0) + (b.out?.length ?? 0) + (b.overdue?.length ?? 0),
        repairs: s.machines.reduce((a, m) => a + (m.damaged ?? 0) + (m.maintenance ?? 0), 0),
      });
    } catch {
      /* ignore */
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onScan(code: string) {
    try {
      const r: any = await staffApi(`/api/ops/resolve/${encodeURIComponent(code)}`);
      if (r.type === 'reservation') return router.push(`/staff/flow/${encodeURIComponent(r.number)}` as any);
      if (r.type === 'unit') return router.push(`/staff/unit/${r.id}` as any);
      if (r.type === 'product') return router.push(`/staff/machine/${r.id}` as any);
    } catch {
      /* silencieux : un code inconnu ne fait rien */
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: C.loc,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>
          Bonjour {staff?.name?.split(' ')[0]}
        </Text>
        <Pressable
          onPress={async () => {
            await logout();
            if (!TEAM_MODE) router.replace('/(tabs)');
          }}
          hitSlop={10}
        >
          <Text style={{ color: '#c9c8ec', fontWeight: '700' }}>
            {TEAM_MODE ? 'Déconnexion' : 'Quitter'}
          </Text>
        </Pressable>
      </View>

      <View style={{ padding: 16, gap: 16 }}>
        <ScanInput onScan={onScan} hint="Scanner une réservation ou une machine" />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {TILES.map((t) => {
            const badge = (counts as any)[t.key] as number | undefined;
            const dark = t.tone === C.loc;
            return (
              <Pressable
                key={t.key}
                onPress={() => router.push(`/staff/${t.key}` as any)}
                style={{
                  width: '47%',
                  backgroundColor: t.tone,
                  borderRadius: R.lg,
                  padding: 20,
                  minHeight: 130,
                  justifyContent: 'space-between',
                  ...(!dark && { borderWidth: 1, borderColor: C.border }),
                }}
              >
                <Ionicons name={t.icon as any} size={30} color={dark ? '#fff' : C.loc} />
                <View>
                  <Text style={{ color: dark ? '#fff' : C.ink, fontWeight: '900', fontSize: 17 }}>
                    {t.label}
                  </Text>
                  {t.sub ? (
                    <Text style={{ color: dark ? '#c9c8ec' : C.muted, fontSize: 12 }}>{t.sub}</Text>
                  ) : null}
                </View>
                {badge ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      backgroundColor: C.brico,
                      borderRadius: 15,
                      minWidth: 30,
                      height: 30,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 8,
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '900' }}>{badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}
