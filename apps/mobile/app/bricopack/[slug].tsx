import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, mediaUrl } from '@/lib/api';
import { formatEUR } from '@/lib/format';
import { useStore } from '@/lib/store';
import { C, R } from '@/lib/theme';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Pack = {
  id: string;
  slug: string;
  name: string;
  intro: string;
  family: string;
  level: string | null;
  teamSize: string | null;
  dailyPrice: number;
  separateTotal: number;
  savingPerDay: number;
  discountPct: number | null;
  items: { slug: string; role: string; why: string; name: string; dailyPrice: number; image: string | null }[];
  consumables: { label: string; detail: string; price: number }[];
  related: { slug: string; name: string; family: string | null }[];
};

const FAM_LABEL: Record<string, string> = {
  peinture: 'Peinture', 'sols-bois': 'Sols & bois', carrelage: 'Carrelage',
  'gros-oeuvre': 'Gros œuvre', plomberie: 'Plomberie', electricite: 'Électricité',
  jardin: 'Jardin', nettoyage: 'Nettoyage', hauteur: 'Hauteur', manutention: 'Manutention',
};

export default function BricoPackDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { addItem } = useStore();
  const [pack, setPack] = useState<Pack | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ pack: Pack }>(`/api/public/bricopacks/${slug}`)
      .then((r) => setPack(r.pack))
      .catch(() => {});
  }, [slug]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function reserve() {
    if (!pack) return;
    setBusy(true);
    try {
      await addItem(pack.id, 1);
      router.push('/commande');
    } finally {
      setBusy(false);
    }
  }

  if (!pack) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ padding: 16 }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={C.ink} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <View style={{ padding: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={C.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 130 }}>
        {/* Hero */}
        <Text
          style={{
            fontSize: 11,
            fontWeight: '900',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: C.brico,
          }}
        >
          BricoPack · {FAM_LABEL[pack.family] ?? pack.family}
        </Text>
        <Text style={{ fontSize: 34, fontWeight: '900', color: C.ink, letterSpacing: -1.4, marginTop: 8, lineHeight: 36 }}>
          {pack.name}
          <Text style={{ color: C.brico }}>.</Text>
        </Text>
        <Text style={{ fontSize: 15, color: C.muted, lineHeight: 22, marginTop: 12 }}>{pack.intro}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {[`${pack.items.length} outils inclus`, pack.level && `Niveau ${pack.level}`, 'Assistance incluse']
            .filter(Boolean)
            .map((b) => (
              <Text
                key={b as string}
                style={{
                  fontSize: 12.5,
                  fontWeight: '800',
                  color: C.ink,
                  backgroundColor: C.surface2,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                {b as string}
              </Text>
            ))}
        </View>

        {/* Outils */}
        <Text
          style={{
            fontSize: 11,
            fontWeight: '900',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: C.brico,
            marginTop: 34,
          }}
        >
          Votre pack se dévoile
        </Text>
        <Text style={{ fontSize: 24, fontWeight: '900', color: C.ink, letterSpacing: -1, marginTop: 8, lineHeight: 27 }}>
          Chaque outil a une vraie raison d’être.
        </Text>

        {pack.items.map((it, i) => (
          <View
            key={it.slug}
            style={{
              flexDirection: 'row',
              gap: 14,
              paddingVertical: 20,
              borderTopWidth: 1,
              borderTopColor: C.border,
              marginTop: i === 0 ? 18 : 0,
            }}
          >
            <View style={{ width: 56, alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '900', color: C.border }}>
                {String(i + 1).padStart(2, '0')}
              </Text>
              {it.image ? (
                <Image
                  source={{ uri: mediaUrl(it.image) }}
                  style={{ width: 52, height: 52, borderRadius: 10, marginTop: 8, backgroundColor: C.surface2 }}
                  resizeMode="contain"
                />
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: '900',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: C.brico,
                }}
              >
                {it.role}
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '900', color: C.ink, letterSpacing: -0.4, marginTop: 4 }}>
                {it.name}
              </Text>
              <Text style={{ fontSize: 13.5, color: C.muted, lineHeight: 19, marginTop: 6 }}>{it.why}</Text>
              <Text style={{ fontSize: 12, fontWeight: '800', color: C.muted, marginTop: 8 }}>
                Location seule : {formatEUR(it.dailyPrice)} / jour
              </Text>
            </View>
          </View>
        ))}

        {/* Comparatif */}
        <View style={{ backgroundColor: C.loc, borderRadius: R.lg, padding: 22, marginTop: 24 }}>
          <Text
            style={{
              fontSize: 10.5,
              fontWeight: '900',
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: '#c9c8ec',
            }}
          >
            Le pack est plus avantageux
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
            <Text style={{ color: '#c9c8ec', fontSize: 13 }}>{pack.items.length} outils séparés</Text>
            <Text style={{ color: '#c9c8ec', fontSize: 15, fontWeight: '800', textDecorationLine: 'line-through' }}>
              {formatEUR(pack.separateTotal)}/j
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Prix du BricoPack</Text>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>{formatEUR(pack.dailyPrice)}/j</Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 14,
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.15)',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }}>
              Économie {formatEUR(pack.savingPerDay)}/j
            </Text>
            {pack.discountPct ? (
              <Text
                style={{
                  backgroundColor: C.brico,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: '900',
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                −{Math.round(pack.discountPct * 100)} %
              </Text>
            ) : null}
          </View>
        </View>

        {/* Consommables */}
        {pack.consumables.length > 0 && (
          <>
            <Text style={{ fontSize: 20, fontWeight: '900', color: C.ink, letterSpacing: -0.6, marginTop: 28 }}>
              Complétez votre pack
            </Text>
            <Text style={{ fontSize: 13, color: C.muted, lineHeight: 18, marginTop: 4, marginBottom: 12 }}>
              Consommables optionnels, à ajouter au panier selon votre surface.
            </Text>
            {pack.consumables.map((c) => (
              <View
                key={c.label}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 11,
                  borderBottomWidth: 1,
                  borderBottomColor: C.border,
                }}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }}>{c.label}</Text>
                  <Text style={{ fontSize: 12, color: C.muted }}>{c.detail}</Text>
                </View>
                {c.price > 0 && (
                  <Text style={{ fontSize: 14, fontWeight: '900', color: C.brico }}>
                    {formatEUR(c.price)}
                  </Text>
                )}
              </View>
            ))}
          </>
        )}

        {/* Packs liés */}
        {pack.related.length > 0 && (
          <>
            <Text style={{ fontSize: 20, fontWeight: '900', color: C.ink, letterSpacing: -0.6, marginTop: 28, marginBottom: 12 }}>
              D’autres packs utiles
            </Text>
            {pack.related.map((r) => (
              <Pressable
                key={r.slug}
                onPress={() => router.push(`/bricopack/${r.slug}` as any)}
                style={{
                  backgroundColor: C.surface2,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '900',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: C.brico,
                  }}
                >
                  {FAM_LABEL[r.family ?? ''] ?? r.family}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '900', color: C.ink, marginTop: 4 }}>{r.name}</Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>

      {/* Barre réservation */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: C.white,
          borderTopWidth: 1,
          borderTopColor: C.border,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 26,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View>
          <Text style={{ fontSize: 11, color: C.muted }}>BricoPack</Text>
          <Text style={{ fontSize: 20, fontWeight: '900', color: C.ink }}>
            {formatEUR(pack.dailyPrice)}
            <Text style={{ fontSize: 12, fontWeight: '600', color: C.muted }}> / j</Text>
          </Text>
        </View>
        <Pressable
          onPress={reserve}
          disabled={busy}
          style={{
            flex: 1,
            backgroundColor: busy ? C.border : C.brico,
            borderRadius: R.pill,
            paddingVertical: 15,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>
            {busy ? '…' : 'Réserver ce BricoPack'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
