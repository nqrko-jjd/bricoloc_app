import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, mediaUrl } from '@/lib/api';
import { formatEUR } from '@/lib/format';
import { C, R } from '@/lib/theme';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Pack = {
  slug: string;
  name: string;
  intro: string;
  family: string;
  teamSize: string | null;
  popular: boolean;
  dailyPrice: number;
  separateTotal: number | null;
  toolCount: number;
  image: string | null;
};

const FAMILIES: [string, string][] = [
  ['tous', 'Tous'],
  ['peinture', 'Peinture'],
  ['sols-bois', 'Sols & bois'],
  ['carrelage', 'Carrelage'],
  ['gros-oeuvre', 'Gros œuvre'],
  ['plomberie', 'Plomberie'],
  ['electricite', 'Électricité'],
  ['jardin', 'Jardin'],
  ['nettoyage', 'Nettoyage'],
  ['hauteur', 'Hauteur'],
  ['manutention', 'Manutention'],
];
const FAM_LABEL = Object.fromEntries(FAMILIES);

export default function BricoPacksScreen() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [fam, setFam] = useState('tous');

  const load = useCallback(() => {
    api<{ packs: Pack[] }>('/api/public/bricopacks')
      .then((r) => setPacks(r.packs ?? []))
      .catch(() => {});
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { tous: packs.length };
    for (const p of packs) c[p.family] = (c[p.family] ?? 0) + 1;
    return c;
  }, [packs]);

  const shown = fam === 'tous' ? packs : packs.filter((p) => p.family === fam);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={C.ink} />
        </Pressable>
        <Text style={{ fontSize: 22, fontWeight: '900', color: C.ink, letterSpacing: -0.5 }}>
          BricoPacks
        </Text>
      </View>

      <FlatList
        data={shown}
        keyExtractor={(p) => p.slug}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 6 }}>
            <Text style={{ color: C.muted, fontSize: 14, lineHeight: 20, marginBottom: 14 }}>
              Une tâche, un pack, un prix. Tous les outils d’un chantier réunis — jusqu’à −30 % vs la
              location séparée.
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 8 }}
            >
              {FAMILIES.filter(([k]) => k === 'tous' || counts[k]).map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => setFam(key)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: R.pill,
                    backgroundColor: fam === key ? C.loc : C.white,
                    borderWidth: 1,
                    borderColor: fam === key ? C.loc : C.border,
                  }}
                >
                  <Text
                    style={{ fontWeight: '800', fontSize: 13, color: fam === key ? '#fff' : C.muted }}
                  >
                    {label}
                    {counts[key] ? ` ${counts[key]}` : ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item: p }) => (
          <Pressable
            onPress={() => router.push(`/bricopack/${p.slug}` as any)}
            style={{
              backgroundColor: C.white,
              borderRadius: R.md,
              borderWidth: 1,
              borderColor: C.border,
              padding: 16,
              gap: 6,
            }}
          >
            {p.image ? (
              <Image
                source={{ uri: mediaUrl(p.image) }}
                style={{ width: '100%', height: 120, borderRadius: 12, backgroundColor: C.surface2 }}
                resizeMode="contain"
              />
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: '900',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: C.brico,
                }}
              >
                {FAM_LABEL[p.family] ?? p.family}
              </Text>
              {p.popular && (
                <Text
                  style={{
                    fontSize: 9.5,
                    fontWeight: '900',
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: '#fff',
                    backgroundColor: C.loc,
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  Populaire
                </Text>
              )}
            </View>
            <Text style={{ fontSize: 18, fontWeight: '900', color: C.ink, letterSpacing: -0.4 }}>
              {p.name}
            </Text>
            <Text style={{ fontSize: 13, color: C.muted, lineHeight: 18 }} numberOfLines={2}>
              {p.intro}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 6,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: C.border,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted }}>
                {p.toolCount} outils{p.teamSize ? ` · ${p.teamSize}` : ''}
              </Text>
              <Text style={{ fontSize: 15, fontWeight: '900', color: C.loc }}>
                {formatEUR(p.dailyPrice)}
                <Text style={{ fontSize: 11, fontWeight: '600', color: C.muted }}> / j</Text>
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
