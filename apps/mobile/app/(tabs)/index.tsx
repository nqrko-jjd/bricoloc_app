import React, { useEffect, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, mediaUrl } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { C, R } from '@/lib/theme';
import { formatEUR } from '@/lib/format';
import type { ProductSummary } from '@/lib/types';
import { Logo, ProductMiniCard } from '@/components/ui';

interface Category {
  slug: string;
  name: string;
  image?: string | null;
  productCount?: number;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
function CAT_ICON(slug: string): IoniconName {
  if (/forer|percage|demolition|casser/.test(slug)) return 'build-outline';
  if (/beton|pierre|maconn/.test(slug)) return 'hammer-outline';
  if (/bois|decoupe|sciage/.test(slug)) return 'cut-outline';
  if (/peinture|finition/.test(slug)) return 'color-palette-outline';
  if (/chauffage|deshumid/.test(slug)) return 'flame-outline';
  if (/exterieur|jardin/.test(slug)) return 'leaf-outline';
  if (/plomberie|electri|sanitaire/.test(slug)) return 'water-outline';
  if (/echelle|echafaud/.test(slug)) return 'layers-outline';
  if (/nettoy|clean/.test(slug)) return 'sparkles-outline';
  if (/pack/.test(slug)) return 'cube-outline';
  return 'construct-outline';
}

export default function HomeScreen() {
  const { user } = useStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [popular, setPopular] = useState<ProductSummary[]>([]);
  const [pack, setPack] = useState<ProductSummary | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [cat, pop, packs] = await Promise.all([
        api<{ categories: Category[] }>('/api/catalog/categories'),
        api<{ products: ProductSummary[] }>('/api/catalog/products?pageSize=6&sort=name'),
        api<{ products: ProductSummary[] }>('/api/catalog/products?kind=PACK&pageSize=1'),
      ]);
      setCategories(cat.categories);
      setPopular((pop.products ?? []).filter((p) => p.image).slice(0, 4));
      setPack(packs.products?.[0] ?? null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const firstName = user?.firstName;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.white }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 6,
          }}
        >
          <Logo size={19} />
          <Pressable onPress={() => router.push('/(tabs)/reservations')} hitSlop={10}>
            <Ionicons name="notifications-outline" size={24} color={C.ink} />
          </Pressable>
        </View>

        {/* Greeting */}
        <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <Text style={{ fontSize: 26, fontWeight: '900', color: C.ink, letterSpacing: -0.5 }}>
            {t('home.greeting')}
            {firstName ? ` ${firstName}` : ''}
          </Text>
          <Text style={{ color: C.muted, marginTop: 2 }}>{t('home.greetingSub')}</Text>
        </View>

        {/* Search */}
        <Pressable
          onPress={() => router.push('/(tabs)/catalogue')}
          style={{
            marginHorizontal: 20,
            marginTop: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: C.surface2,
            borderRadius: R.md,
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
        >
          <Ionicons name="search" size={18} color={C.muted} />
          <Text style={{ color: C.muted }}>{t('home.searchShort')}</Text>
        </Pressable>

        {/* Categories */}
        <SectionHead title={t('home.categories')} onSeeAll={() => router.push('/(tabs)/catalogue')} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
        >
          {categories.slice(0, 10).map((c) => (
            <Pressable
              key={c.slug}
              onPress={() => router.push(`/catalogue?category=${c.slug}`)}
              style={{ alignItems: 'center', width: 92 }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: R.md,
                  backgroundColor: C.surface2,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={CAT_ICON(c.slug)} size={28} color={C.brico} />
              </View>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: C.ink,
                  marginTop: 7,
                  textAlign: 'center',
                }}
                numberOfLines={2}
              >
                {c.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* BricoPack */}
        {pack && (
          <Pressable
            onPress={() => router.push(`/produit/${pack.slug}`)}
            style={{
              marginHorizontal: 20,
              marginTop: 24,
              backgroundColor: C.redTint,
              borderRadius: R.lg,
              padding: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: C.ink, letterSpacing: -0.5 }}>
                {t('home.packTitle')}
              </Text>
              <Text style={{ color: C.muted, marginTop: 4, fontSize: 13 }}>{t('home.packText')}</Text>
              <Text style={{ fontWeight: '900', color: C.brico, fontSize: 18, marginTop: 10 }}>
                {formatEUR(pack.dailyPrice)}
                <Text style={{ fontWeight: '600', color: C.muted, fontSize: 12 }}> / jour</Text>
              </Text>
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: C.brico,
                  borderRadius: R.pill,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  marginTop: 12,
                }}
              >
                <Text style={{ color: C.white, fontWeight: '800', fontSize: 13 }}>
                  {t('home.packCta')}
                </Text>
              </View>
            </View>
            {pack.image && (
              <Image
                source={{ uri: mediaUrl(pack.image) }}
                style={{ width: 110, height: 110, borderRadius: R.md }}
                resizeMode="cover"
              />
            )}
          </Pressable>
        )}

        {/* Populaires */}
        <SectionHead title={t('home.popular')} onSeeAll={() => router.push('/(tabs)/catalogue')} />
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            paddingHorizontal: 20,
            gap: 14,
          }}
        >
          {popular.map((p) => (
            <ProductMiniCard key={p.id} p={p} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHead({ title, onSeeAll }: { title: string; onSeeAll: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingHorizontal: 20,
        marginTop: 26,
        marginBottom: 14,
      }}
    >
      <Text style={{ fontSize: 17, fontWeight: '900', color: C.ink, letterSpacing: -0.3 }}>
        {title}
      </Text>
      <Pressable onPress={onSeeAll}>
        <Text style={{ color: C.brico, fontWeight: '700', fontSize: 13 }}>{t('home.seeAll')}</Text>
      </Pressable>
    </View>
  );
}
