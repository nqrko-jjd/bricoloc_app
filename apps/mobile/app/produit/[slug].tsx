import { useEffect, useState } from 'react';
import { Image, Text, TextInput, View, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, mediaUrl } from '@/lib/api';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { t as ti } from '@/lib/i18n';
import { formatEUR } from '@/lib/format';
import { Screen, H1, H2, P, Card, Button, Badge } from '@/components/ui';
import type { ProductDetail } from '@/lib/types';

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { cart, addItem } = useStore();
  const router = useRouter();
  const [p, setP] = useState<ProductDetail | null>(null);
  const [qty, setQty] = useState(1);
  const [extras, setExtras] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const sp = cart?.period
      ? `?start=${cart.period.start}&end=${cart.period.end}`
      : '';
    api<{ product: ProductDetail }>(`/api/catalog/products/${slug}${sp}`).then((r) =>
      setP(r.product),
    );
  }, [slug, cart?.period]);

  if (!p) return <Screen><P>Chargement…</P></Screen>;

  const linked = [
    ...p.recommendedAccessories.map((x) => ({ ...x, g: 'Accessoire' })),
    ...p.consumables.map((x) => ({ ...x, g: 'Consommable' })),
    ...p.ppe.map((x) => ({ ...x, g: 'Protection' })),
  ];
  const a = p.availability?.status;

  async function add() {
    await addItem(p!.id, qty);
    for (const l of linked) if (extras[l.id]) await addItem(l.id, l.quantity || 1);
    setMsg('Ajouté au panier');
  }

  return (
    <Screen>
      <Image
        source={{ uri: mediaUrl(p.image) ?? 'https://placehold.co/600x400/eef0f3/0B1D3A/png?text=BRICOLOC' }}
        style={{ width: '100%', height: 200, borderRadius: 12, backgroundColor: C.bg }}
      />
      <H1>{p.name}</H1>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        {p.category && <Badge text={p.category.name} />}
        {a === 'AVAILABLE' ? (
          <Badge text={`Disponible (${p.availability?.availableQty})`} tone="ok" />
        ) : a === 'PARTIAL' ? (
          <Badge text="Stock limité" tone="warn" />
        ) : a ? (
          <Badge text="Indisponible" tone="err" />
        ) : (
          <Badge text="Choisissez vos dates" />
        )}
      </View>
      <Text style={{ fontSize: 20, fontWeight: '800', color: C.loc }}>
        {formatEUR(p.dailyPrice)}
        <Text style={{ fontSize: 13, color: C.lightGray }}> / {p.isConsumable ? 'unité' : 'jour'}</Text>
      </Text>
      {!p.isConsumable && (
        <P muted>
          Week-end {p.weekendPrice ? formatEUR(p.weekendPrice) : '—'} · Caution{' '}
          {formatEUR(p.deposit)}
        </P>
      )}
      {p.description ? <P>{p.description}</P> : null}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Text style={{ fontWeight: '700', color: C.loc }}>Quantité</Text>
          <Pressable onPress={() => setQty((q) => Math.max(1, q - 1))} style={stepBtn}>
            <Text style={stepT}>−</Text>
          </Pressable>
          <Text style={{ fontSize: 16 }}>{qty}</Text>
          <Pressable onPress={() => setQty((q) => q + 1)} style={stepBtn}>
            <Text style={stepT}>+</Text>
          </Pressable>
        </View>
        {linked.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontWeight: '700', color: C.loc, marginBottom: 6 }}>
              Ajouter en un geste
            </Text>
            {linked.map((l) => (
              <Pressable
                key={l.id}
                onPress={() => setExtras((s) => ({ ...s, [l.id]: !s[l.id] }))}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: C.loc,
                    backgroundColor: extras[l.id] ? C.loc : 'transparent',
                  }}
                />
                <Text style={{ flex: 1 }}>
                  {l.name}{' '}
                  <Text style={{ color: C.lightGray }}>
                    ({l.g} · {formatEUR(l.dailyPrice)})
                  </Text>
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <Button
          title="Ajouter au panier"
          onPress={add}
          disabled={a === 'UNAVAILABLE'}
        />
        {msg ? (
          <Pressable onPress={() => router.push('/panier')}>
            <Text style={{ color: C.ok, fontWeight: '700', textAlign: 'center', marginTop: 6 }}>
              {msg} — voir le panier →
            </Text>
          </Pressable>
        ) : null}
      </Card>

      {p.tiers.length > 0 && (
        <Card>
          <H2>Tarifs dégressifs</H2>
          {p.tiers.map((t) => (
            <Text key={t.minDays} style={{ paddingVertical: 2 }}>
              Dès {t.minDays} j : {formatEUR(t.perDay)} / jour
            </Text>
          ))}
        </Card>
      )}

      {p.recommendedUses.length > 0 && (
        <Card>
          <H2>Utilisations conseillées</H2>
          {p.recommendedUses.map((u) => (
            <Text key={u} style={{ paddingVertical: 2 }}>
              • {u}
            </Text>
          ))}
        </Card>
      )}

      {Object.keys(p.specs).length > 0 && (
        <Card>
          <H2>Caractéristiques</H2>
          {Object.entries(p.specs).map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
              <Text style={{ color: C.lightGray }}>{k}</Text>
              <Text style={{ fontWeight: '600' }}>{v}</Text>
            </View>
          ))}
        </Card>
      )}

      <Reviews slug={slug} />
    </Screen>
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
