import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, mediaUrl } from '@/lib/api';
import { t as ti } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { formatEUR, formatDateBE } from '@/lib/format';
import { Button, Badge } from '@/components/ui';
import { PeriodPicker } from '@/components/PeriodPicker';
import type { ProductSummary } from '@/lib/types';

interface Category {
  slug: string;
  name: string;
  productCount?: number;
}

export default function CatalogueScreen() {
  const { cart, setPeriod } = useStore();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [loading, setLoading] = useState(true);
  const [editDates, setEditDates] = useState(false);

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
    api<{ categories: Category[] }>('/api/catalog/categories').then((r) =>
      setCategories(r.categories),
    );
  }, []);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cat, cart?.period]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <View style={{ backgroundColor: C.loc, padding: 12 }}>
        {cart?.period ? (
          <Pressable onPress={() => setEditDates((v) => !v)}>
            <Text style={{ color: C.white }}>
              📅 {formatDateBE(cart.period.start)} → {formatDateBE(cart.period.end)}{' '}
              <Text style={{ color: C.brico, fontWeight: '800' }}>Modifier</Text>
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setEditDates((v) => !v)}>
            <Text style={{ color: C.white }}>
              📅 Aucune date —{' '}
              <Text style={{ color: C.brico, fontWeight: '800' }}>choisir mes dates</Text>
            </Text>
          </Pressable>
        )}
      </View>

      {editDates && (
        <View style={{ backgroundColor: C.white, padding: 14, borderBottomWidth: 1, borderColor: C.border }}>
          <PeriodPicker
            initial={cart?.period}
            onConfirm={async (p) => {
              await setPeriod(p);
              setEditDates(false);
            }}
          />
          {cart?.period && (
            <Button
              title="Parcourir sans dates"
              variant="ghost"
              onPress={async () => {
                await setPeriod(null);
                setEditDates(false);
              }}
            />
          )}
        </View>
      )}

      <View style={{ padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput
          placeholder={ti('home.search')}
          placeholderTextColor={C.lightGray}
          value={q}
          onChangeText={setQ}
          style={{
            backgroundColor: C.white,
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            flex: 1,
          }}
        />
        <Pressable
          onPress={() => router.push('/scan')}
          accessibilityLabel={ti('home.scan')}
          style={{
            backgroundColor: C.loc,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 11,
          }}
        >
          <Text style={{ color: C.white, fontSize: 18 }}>⌗</Text>
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 12 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 10 }}
          data={[{ slug: '', name: 'Tout' }, ...categories]}
          keyExtractor={(c) => c.slug || 'all'}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setCat(item.slug)}
              style={{
                backgroundColor: cat === item.slug ? C.loc : C.white,
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
                marginRight: 8,
              }}
            >
              <Text style={{ color: cat === item.slug ? C.white : C.darkGray, fontWeight: '600' }}>
                {item.name}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          !loading ? (
            <Text style={{ color: C.lightGray, textAlign: 'center', marginTop: 30 }}>
              Aucun article{cart?.period ? ' disponible sur cette période' : ''}.
            </Text>
          ) : null
        }
        renderItem={({ item }) => <ProductRow p={item} />}
      />
    </SafeAreaView>
  );
}

function ProductRow({ p }: { p: ProductSummary }) {
  const { addItem } = useStore();
  const a = p.availability?.status;
  return (
    <Link href={`/produit/${p.slug}`} asChild>
      <Pressable
        style={{
          backgroundColor: C.white,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: C.border,
          padding: 10,
          marginBottom: 10,
          flexDirection: 'row',
          gap: 10,
        }}
      >
        <Image
          source={{ uri: mediaUrl(p.image) ?? 'https://placehold.co/120x90/eef0f3/0B1D3A/png?text=BRICOLOC' }}
          style={{ width: 90, height: 68, borderRadius: 8, backgroundColor: C.bg }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: C.loc }}>{p.name}</Text>
          <Text style={{ color: C.lightGray, fontSize: 12 }} numberOfLines={1}>
            {p.shortDescription}
          </Text>
          <Text style={{ fontWeight: '800', color: C.loc, marginTop: 2 }}>
            {formatEUR(p.dailyPrice)}
            <Text style={{ fontWeight: '400', color: C.lightGray, fontSize: 12 }}>
              {' '}
              / {p.isConsumable ? 'unité' : 'jour'}
            </Text>
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            {a === 'AVAILABLE' ? (
              <Badge text="Disponible" tone="ok" />
            ) : a === 'PARTIAL' ? (
              <Badge text="Stock limité" tone="warn" />
            ) : a ? (
              <Badge text="Indisponible" tone="err" />
            ) : (
              <Badge text="Dates ?" />
            )}
            <Pressable
              onPress={() => addItem(p.id, 1)}
              style={{ backgroundColor: C.brico, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
            >
              <Text style={{ color: C.white, fontWeight: '700' }}>+ Panier</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
