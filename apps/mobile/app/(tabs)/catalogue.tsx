import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { C, R } from '@/lib/theme';
import type { ProductSummary } from '@/lib/types';
import { Logo, ProductListRow, ProductMiniCard } from '@/components/ui';
import { useAdaptiveLayout } from '@/lib/layout';

interface Category {
  slug: string;
  name: string;
}

export default function CatalogueScreen() {
  const params = useLocalSearchParams<{ category?: string; focus?: string }>();
  const { cart } = useStore();
  const { columns, contentWidth } = useAdaptiveLayout();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(params.category ?? '');
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(false);
  const request = useRef(0);
  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    if (params.category !== undefined) setCat(params.category);
  }, [params.category]);

  useEffect(() => {
    if (params.focus) {
      const id = setTimeout(() => searchRef.current?.focus(), 350);
      return () => clearTimeout(id);
    }
  }, [params.focus]);

  async function load(nextPage = 1) {
    const id = ++request.current;
    setLoading(true); setError(false);
    const sp = new URLSearchParams({ pageSize: '40', page: String(nextPage), sort: 'name', kind: 'MACHINE' });
    if (q) sp.set('q', q);
    if (cat) sp.set('category', cat);
    if (cart?.period) { sp.set('start', cart.period.start); sp.set('end', cart.period.end); }
    try {
      const r = await api<{ products: ProductSummary[]; total: number }>(`/api/catalog/products?${sp}`);
      if (id !== request.current) return;
      setProducts((prev) => nextPage === 1 ? r.products : [...prev, ...r.products]);
      setTotal(r.total); setPage(nextPage);
    } catch { if (id === request.current) setError(true); }
    finally { if (id === request.current) setLoading(false); }
  }
  useEffect(() => {
    let cancelled = false;
    api<{ categories: Category[] }>('/api/catalog/categories')
      .then((r) => { if (!cancelled) setCategories(r.categories); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    request.current++; setLoading(true);
    const id = setTimeout(() => { void load(); }, q ? 300 : 0);
    return () => { clearTimeout(id); request.current++; };
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
          ref={searchRef}
          placeholder={t('cat.search')}
          placeholderTextColor={C.muted}
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
          style={{ flex: 1, color: C.ink, fontSize: 14 }}
        />
        {q ? (
          <Pressable onPress={() => setQ('')} hitSlop={8}>
            <Ionicons name="close-circle" size={17} color={C.muted} />
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.push('/scan')} hitSlop={8}>
          <Ionicons name="scan-outline" size={19} color={C.loc} />
        </Pressable>
      </View>

      {/* Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 14, flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingVertical: 2 }}
      >
        {chips.map((item) => {
          const active = cat === item.slug;
          return (
            <Pressable
              key={item.slug || 'all'}
              onPress={() => setCat(item.slug)}
              style={{
                backgroundColor: active ? C.loc : C.white,
                borderWidth: 1,
                borderColor: active ? C.loc : C.border,
                borderRadius: R.pill,
                paddingHorizontal: 15,
                paddingVertical: 9,
                minHeight: 44,
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: active ? C.white : C.ink, fontWeight: '700', fontSize: 13 }}>
                {item.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Liste */}
      <FlatList
        key={`catalogue-${columns}`}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: 16 } : undefined}
        style={{ width: '100%', maxWidth: contentWidth, alignSelf: 'center' }}
        data={products}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120, gap: 10 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(); }} />}
        ListFooterComponent={
          error ? <View style={{ paddingVertical: 20, gap: 12 }}><Text style={{ color: C.err }}>{t('cat.error')}</Text><Pressable accessibilityRole="button" onPress={() => { void load(products.length ? page + 1 : 1); }} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: R.md, backgroundColor: C.surface2 }}><Text style={{ color: C.ink }}>{t('cat.retry')}</Text></Pressable></View>
          : products.length < total ? <Pressable accessibilityRole="button" disabled={loading} onPress={() => { void load(page + 1); }} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 16, borderRadius: R.md, backgroundColor: C.surface2 }}><Text style={{ color: C.ink }}>{loading ? t('common.loading') : t('cat.more')}</Text></Pressable> : null
        }
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={{ color: C.muted, textAlign: 'center', marginTop: 40 }}>{t('cat.empty')}</Text>
          ) : null
        }
        renderItem={({ item }) => columns > 1 ? <View style={{ flex: 1, maxWidth: (contentWidth - 40 - (columns - 1) * 16) / columns }}><ProductMiniCard p={item} width="100%" /></View> : <ProductListRow p={item} />}
      />
    </SafeAreaView>
  );
}
