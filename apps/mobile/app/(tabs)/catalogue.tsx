import { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { C, R } from '@/lib/theme';
import type { ProductSummary } from '@/lib/types';
import { Logo, ProductMiniCard } from '@/components/ui';

interface Category {
  slug: string;
  name: string;
}

export default function CatalogueScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const { cart } = useStore();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(params.category ?? '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.category !== undefined) setCat(params.category);
  }, [params.category]);

  async function load() {
    setLoading(true);
    const sp = new URLSearchParams({ pageSize: '40', sort: 'name' });
    if (q) sp.set('q', q);
    if (cat) sp.set('category', cat);
    if (cart?.period) {
      sp.set('start', cart.period.start);
      sp.set('end', cart.period.end);
    }
    try {
      const r = await api<{ products: ProductSummary[] }>(`/api/catalog/products?${sp}`);
      setProducts(r.products);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api<{ categories: Category[] }>('/api/catalog/categories').then((r) => setCategories(r.categories));
  }, []);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cat, cart?.period]);

  const chips = [{ slug: '', name: t('cat.all') }, ...categories];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.white }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 8,
        }}
      >
        <Logo size={18} />
        <Pressable onPress={() => router.push('/(tabs)/panier')} hitSlop={10}>
          <Ionicons name="cart-outline" size={24} color={C.ink} />
          {cart && cart.itemCount > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: -4,
                right: -6,
                backgroundColor: C.brico,
                borderRadius: 9,
                minWidth: 18,
                height: 18,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: C.white, fontSize: 10, fontWeight: '800' }}>{cart.itemCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <Text
        style={{
          fontSize: 26,
          fontWeight: '900',
          color: C.locDeep,
          letterSpacing: -0.6,
          paddingHorizontal: 20,
          marginTop: 10,
        }}
      >
        {t('cat.title')}
      </Text>

      {/* Search */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginHorizontal: 20,
          marginTop: 14,
          backgroundColor: C.surface2,
          borderRadius: R.md,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <Ionicons name="search" size={17} color={C.muted} />
        <TextInput
          placeholder={t('cat.search')}
          placeholderTextColor={C.muted}
          value={q}
          onChangeText={setQ}
          style={{ flex: 1, color: C.ink, fontSize: 14 }}
        />
        <Pressable onPress={() => router.push('/scan')} hitSlop={8}>
          <Ionicons name="scan-outline" size={19} color={C.loc} />
        </Pressable>
      </View>

      {/* Chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={chips}
        keyExtractor={(c) => c.slug || 'all'}
        style={{ marginTop: 14, flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        renderItem={({ item }) => {
          const active = cat === item.slug;
          return (
            <Pressable
              onPress={() => setCat(item.slug)}
              style={{
                backgroundColor: active ? C.loc : C.white,
                borderWidth: 1,
                borderColor: active ? C.loc : C.border,
                borderRadius: R.pill,
                paddingHorizontal: 15,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: active ? C.white : C.ink, fontWeight: '700', fontSize: 13 }}>
                {item.name}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* Grid */}
      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 14, paddingHorizontal: 20 }}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 32, gap: 14 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          !loading ? (
            <Text style={{ color: C.muted, textAlign: 'center', marginTop: 40 }}>{t('cat.empty')}</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <ProductMiniCard p={item} width="100%" />
          </View>
        )}
      />
    </SafeAreaView>
  );
}
