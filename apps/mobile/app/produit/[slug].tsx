import { useEffect, useState } from 'react';
import { Image, ScrollView, Text, TextInput, View, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, mediaUrl } from '@/lib/api';
import { useStore } from '@/lib/store';
import { C, R } from '@/lib/theme';
import { t as ti } from '@/lib/i18n';
import { formatEUR } from '@/lib/format';
import { H2, P, Card, Button } from '@/components/ui';
import type { ProductDetail } from '@/lib/types';

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { cart, addItem } = useStore();
  const router = useRouter();
  const [p, setP] = useState<ProductDetail | null>(null);
  const [qty, setQty] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [extras, setExtras] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const sp = cart?.period ? `?start=${cart.period.start}&end=${cart.period.end}` : '';
    api<{ product: ProductDetail }>(`/api/catalog/products/${slug}${sp}`).then((r) => setP(r.product));
  }, [slug, cart?.period]);

  if (!p) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
        <P muted>{ti('common.loading')}</P>
      </SafeAreaView>
    );
  }

  const linked = [
    ...p.recommendedAccessories.map((x) => ({ ...x, g: 'Accessoire' })),
    ...p.consumables.filter((x) => x.dailyPrice > 0).map((x) => ({ ...x, g: 'Consommable' })),
    ...p.ppe.map((x) => ({ ...x, g: 'Protection' })),
  ];

  const priceRows: { label: string; value: number }[] = p.isConsumable
    ? [{ label: ti('prod.priceUnit'), value: p.dailyPrice }]
    : [
        { label: ti('prod.priceDay'), value: p.dailyPrice },
        { label: ti('prod.priceWeek'), value: p.weekPrice },
        { label: ti('prod.priceMonth'), value: p.monthPrice },
      ].flatMap((r) => (r.value != null ? [{ label: r.label, value: r.value }] : []));
  const a = p.availability?.status;
  const rating = p.rating;

  async function add() {
    await addItem(p!.id, qty);
    for (const l of linked) if (extras[l.id]) await addItem(l.id, l.quantity || 1);
    setMsg('Ajouté au panier');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.white }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 8,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={C.ink} />
        </Pressable>
        <Pressable hitSlop={10}>
          <Ionicons name="heart-outline" size={24} color={C.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Image
          source={{
            uri: mediaUrl(p.image) ?? 'https://placehold.co/600x400/eeeef7/08065d/png?text=BRICOLOC',
          }}
          style={{ width: '100%', height: 300, backgroundColor: C.white }}
          resizeMode="contain"
        />

        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: C.locDeep, letterSpacing: -0.6 }}>
            {p.name}
          </Text>
          {rating && rating.count > 0 ? (
            <Text style={{ color: C.muted, marginTop: 6, fontWeight: '600' }}>
              ★ {rating.avg.toFixed(1)} ({rating.count} {ti('prod.reviews')})
            </Text>
          ) : null}

          {/* Tarifs */}
          <Text style={{ fontWeight: '800', color: C.ink, marginTop: 20, marginBottom: 10 }}>
            {ti('prod.duration')}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              borderRadius: R.sm,
              backgroundColor: C.surface2,
              overflow: 'hidden',
            }}
          >
            {priceRows.map((row, i) => (
              <View
                key={row.label}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 14,
                  borderLeftWidth: i === 0 ? 0 : 1,
                  borderLeftColor: C.border,
                }}
              >
                <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>
                  {row.label}
                </Text>
                <Text style={{ color: C.locDeep, fontWeight: '900', fontSize: 16 }}>
                  {formatEUR(row.value)}
                </Text>
              </View>
            ))}
          </View>

          {/* Description */}
          {p.description ? (
            <View style={{ marginTop: 20 }}>
              <Text style={{ color: C.ink, lineHeight: 21 }} numberOfLines={expanded ? undefined : 3}>
                {p.description}
              </Text>
              <Pressable onPress={() => setExpanded((v) => !v)} style={{ marginTop: 6 }}>
                <Text style={{ color: C.muted, fontWeight: '700' }}>
                  {expanded ? ti('prod.seeLess') : ti('prod.seeMore')}{' '}
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} />
                </Text>
              </Pressable>
            </View>
          ) : null}

          {a && a !== 'AVAILABLE' ? (
            <Text
              style={{
                marginTop: 16,
                color: a === 'PARTIAL' ? C.warn : C.err,
                fontWeight: '700',
              }}
            >
              {a === 'PARTIAL' ? 'Stock limité sur cette période' : 'Indisponible sur cette période'}
            </Text>
          ) : null}

          {linked.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <Text style={{ fontWeight: '800', color: C.ink, marginBottom: 8 }}>
                Consommables & accessoires adaptés
              </Text>
              {linked.map((l) => (
                <Pressable
                  key={l.id}
                  onPress={() => setExtras((s) => ({ ...s, [l.id]: !s[l.id] }))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: extras[l.id] ? C.brico : C.border,
                      backgroundColor: extras[l.id] ? C.brico : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {extras[l.id] && <Ionicons name="checkmark" size={14} color={C.white} />}
                  </View>
                  <Text style={{ flex: 1, color: C.ink }}>
                    {l.name}
                    <Text style={{ color: C.muted }}>
                      {' '}
                      · {formatEUR(l.dailyPrice)}
                      {l.isConsumable ? '' : '/j'}
                    </Text>
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {Object.keys(p.specs).length > 0 && (
            <Card style={{ marginTop: 20 }}>
              <H2>Caractéristiques</H2>
              {Object.entries(p.specs).map(([k, v]) => (
                <View
                  key={k}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}
                >
                  <Text style={{ color: C.muted }}>{k}</Text>
                  <Text style={{ fontWeight: '600', color: C.ink }}>{v}</Text>
                </View>
              ))}
            </Card>
          )}

          <Reviews slug={slug} />
        </View>
      </ScrollView>

      {/* Barre d'action fixe */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: C.white,
          borderTopWidth: 1,
          borderTopColor: C.border,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 26,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View>
          <Text style={{ fontSize: 20, fontWeight: '900', color: C.ink, letterSpacing: -0.4 }}>
            {formatEUR(p.dailyPrice)}
          </Text>
          <Text style={{ fontSize: 11, color: C.muted }}>/ {p.isConsumable ? 'unité' : 'jour'}</Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: R.pill,
          }}
        >
          <Pressable onPress={() => setQty((q) => Math.max(1, q - 1))} style={{ padding: 10 }}>
            <Ionicons name="remove" size={16} color={C.ink} />
          </Pressable>
          <Text style={{ fontWeight: '800', minWidth: 18, textAlign: 'center' }}>{qty}</Text>
          <Pressable onPress={() => setQty((q) => q + 1)} style={{ padding: 10 }}>
            <Ionicons name="add" size={16} color={C.ink} />
          </Pressable>
        </View>
        <Pressable
          onPress={add}
          disabled={a === 'UNAVAILABLE'}
          style={{
            flex: 1,
            backgroundColor: a === 'UNAVAILABLE' ? C.border : C.brico,
            borderRadius: R.pill,
            paddingVertical: 15,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: C.white, fontWeight: '900', fontSize: 15 }}>{ti('prod.book')}</Text>
        </Pressable>
      </View>

      {msg ? (
        <Pressable
          onPress={() => router.push('/(tabs)/panier')}
          style={{
            position: 'absolute',
            bottom: 96,
            alignSelf: 'center',
            backgroundColor: C.locDeep,
            borderRadius: R.pill,
            paddingHorizontal: 18,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: C.white, fontWeight: '700' }}>{msg} — voir le panier →</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

function Reviews({ slug }: { slug: string }) {
  const { user } = useStore();
  const [data, setData] = useState<{
    summary: { avg: number; count: number };
    reviews: { id: string; authorName: string; rating: number; title: string | null; body: string }[];
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ rating: 5, body: '', authorName: '' });
  const [done, setDone] = useState('');

  async function load() {
    setData(
      await api<NonNullable<typeof data>>(`/api/products/${slug}/reviews`).catch(() => null),
    );
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <H2>{ti('reviews.title')}</H2>
        {data && data.summary.count > 0 && (
          <Text style={{ fontWeight: '800', color: C.locDeep }}>
            {'★'.repeat(Math.round(data.summary.avg))} {data.summary.avg.toFixed(1)} ({data.summary.count})
          </Text>
        )}
      </View>
      {!data || data.reviews.length === 0 ? (
        <P muted>{ti('reviews.none')}</P>
      ) : (
        data.reviews.slice(0, 5).map((r) => (
          <View key={r.id} style={{ paddingVertical: 6, borderTopWidth: 1, borderColor: C.border }}>
            <Text style={{ fontWeight: '700' }}>
              {r.authorName} · {'★'.repeat(r.rating)}
            </Text>
            {r.title ? <Text style={{ fontWeight: '600' }}>{r.title}</Text> : null}
            <Text style={{ color: C.ink }}>{r.body}</Text>
          </View>
        ))
      )}

      {done ? (
        <P>{done}</P>
      ) : open ? (
        <View style={{ gap: 8, marginTop: 8 }}>
          {!user && (
            <TextInput
              placeholder={ti('reviews.rating')}
              value={form.authorName}
              onChangeText={(v) => setForm({ ...form, authorName: v })}
              placeholderTextColor={C.lightGray}
              style={inp}
            />
          )}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setForm({ ...form, rating: n })}>
                <Text style={{ fontSize: 26, color: n <= form.rating ? '#f5a623' : C.border }}>★</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            placeholder={ti('reviews.body')}
            value={form.body}
            onChangeText={(v) => setForm({ ...form, body: v })}
            multiline
            placeholderTextColor={C.lightGray}
            style={[inp, { minHeight: 80 }]}
          />
          <Button
            title={ti('reviews.submit')}
            onPress={async () => {
              try {
                await api('/api/reviews', {
                  method: 'POST',
                  body: {
                    productSlug: slug,
                    rating: form.rating,
                    body: form.body,
                    authorName: user ? undefined : form.authorName || undefined,
                  },
                });
                setDone(ti('reviews.thanks'));
                setOpen(false);
                load();
              } catch (e) {
                setDone(e instanceof Error ? e.message : 'Erreur');
              }
            }}
          />
        </View>
      ) : (
        <Button title={ti('reviews.write')} variant="outline" onPress={() => setOpen(true)} />
      )}
    </Card>
  );
}

const inp = {
  backgroundColor: C.white,
  borderWidth: 1,
  borderColor: C.border,
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 8,
};

const stepBtn = {
  backgroundColor: C.loc,
  width: 38,
  height: 38,
  borderRadius: 8,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
const stepT = { color: C.white, fontSize: 20, fontWeight: '800' as const };
