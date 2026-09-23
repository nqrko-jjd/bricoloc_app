import React, { useEffect, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, mediaUrl } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { C, R } from '@/lib/theme';
import { Price } from '@/components/Price';
import type { ProductSummary } from '@/lib/types';
import { Logo, ProductListRow } from '@/components/ui';

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

const ACTIVE_STATUSES = ['CONFIRMED', 'PREPARING', 'READY', 'OUT', 'RETURN_PENDING'];

export default function HomeScreen() {
  const { user } = useStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [popular, setPopular] = useState<ProductSummary[]>([]);
  const [packs, setPacks] = useState<
    { slug: string; name: string; dailyPrice: number; image: string | null; toolCount?: number; popular?: boolean }[]
  >([]);
  const [productsAvailable, setProductsAvailable] = useState<number | null>(null);
  const [activeRentals, setActiveRentals] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [cat, pop, bp] = await Promise.all([
        api<{ categories: Category[] }>('/api/catalog/categories'),
        api<{ products: ProductSummary[]; total?: number }>('/api/catalog/products?pageSize=6&sort=name'),
        api<{ packs: typeof packs }>('/api/public/bricopacks').catch(() => ({ packs: [] as typeof packs })),
      ]);
      setCategories(cat.categories);
      setPopular((pop.products ?? []).filter((p) => p.image).slice(0, 4));
      setProductsAvailable(pop.total ?? null);
      setPacks(
        [...(bp.packs ?? [])].sort((a, b) => Number(!!b.popular) - Number(!!a.popular)).slice(0, 10),
      );
      if (user) {
        const res = await api<{ reservations: { status: string }[] }>('/api/reservations').catch(
          () => ({ reservations: [] }),
        );
        setActiveRentals(res.reservations.filter((r) => ACTIVE_STATUSES.includes(r.status)).length);
      } else {
        setActiveRentals(null);
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const firstName = user?.firstName;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.white }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
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
          onPress={() => router.push('/(tabs)/catalogue?focus=1')}
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

        {/* Actions rapides */}
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 16 }}>
          <Pressable
            onPress={() => router.push('/(tabs)/catalogue')}
            style={{
              flex: 1,
              backgroundColor: C.brico,
              borderRadius: R.md,
              padding: 16,
              gap: 22,
            }}
          >
            <Ionicons name="cube-outline" size={22} color={C.white} />
            <View>
              <Text style={{ color: C.white, fontWeight: '900', fontSize: 14.5 }}>Louer un outil</Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11.5, marginTop: 2, fontWeight: '600' }}>
                {productsAvailable != null ? `${productsAvailable} disponibles` : 'Voir le catalogue'}
              </Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/reservations')}
            style={{
              flex: 1,
              backgroundColor: C.surface2,
              borderRadius: R.md,
              padding: 16,
              gap: 22,
              borderWidth: 1,
              borderColor: C.border,
            }}
          >
            <Ionicons name="calendar-outline" size={22} color={C.brico} />
            <View>
              <Text style={{ color: C.ink, fontWeight: '900', fontSize: 14.5 }}>Mes locations</Text>
              <Text style={{ color: C.muted, fontSize: 11.5, marginTop: 2, fontWeight: '600' }}>
                {user
                  ? activeRentals != null
                    ? activeRentals > 0
                      ? `${activeRentals} en cours`
                      : 'Aucune en cours'
                    : '—'
                  : 'Se connecter'}
              </Text>
            </View>
          </Pressable>
        </View>

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

        {/* BricoPacks — slider */}
        {packs.length > 0 && (
          <>
            <SectionHead
              title={t('home.packTitle') + 's'}
              onSeeAll={() => router.push('/bricopacks' as never)}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              decelerationRate="fast"
              snapToInterval={200}
            >
              {packs.map((bp) => (
                <Pressable
                  key={bp.slug}
                  onPress={() => router.push(`/bricopack/${bp.slug}` as never)}
                  style={{
                    width: 188,
                    backgroundColor: C.white,
                    borderRadius: R.md,
                    borderWidth: 1,
                    borderColor: C.border,
                    overflow: 'hidden',
                  }}
                >
                  <View style={{ height: 108, backgroundColor: C.surface2 }}>
                    {bp.image ? (
                      <Image
                        source={{ uri: mediaUrl(bp.image) }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="cube-outline" size={30} color={C.brico} />
                      </View>
                    )}
                    {bp.popular ? (
                      <View
                        style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          backgroundColor: C.brico,
                          borderRadius: R.pill,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <Text style={{ color: C.white, fontSize: 10, fontWeight: '800' }}>POPULAIRE</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ padding: 12, gap: 3 }}>
                    <Text style={{ fontWeight: '800', color: C.ink, fontSize: 13 }} numberOfLines={2}>
                      {bp.name}
                    </Text>
                    {bp.toolCount ? (
                      <Text style={{ color: C.muted, fontSize: 11 }}>{bp.toolCount} outils</Text>
                    ) : null}
                    <Text style={{ fontWeight: '900', color: C.ink, fontSize: 14 }}>
                      <Price amountHT={bp.dailyPrice} />
                      <Text style={{ fontWeight: '600', color: C.muted, fontSize: 11 }}> / jour</Text>
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {/* Populaires */}
        <SectionHead title={t('home.popular')} onSeeAll={() => router.push('/(tabs)/catalogue')} />
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {popular.map((p) => (
            <ProductListRow key={p.id} p={p} />
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
