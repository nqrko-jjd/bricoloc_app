import React, { createContext, useCallback, useContext, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, mediaUrl } from '@/lib/api';
import { useStore } from '@/lib/store';
import { C, R } from '@/lib/theme';
import { t as ti } from '@/lib/i18n';
import { formatEUR } from '@/lib/format';
import type { ProductDetail } from '@/lib/types';

interface Ctx {
  open: (slug: string) => void;
}
const QuickViewContext = createContext<Ctx | null>(null);

/**
 * Aperçu produit en fenêtre modale (comme la borne) : on consulte et on ajoute
 * au panier sans quitter la liste. Un seul provider monté à la racine.
 */
export function ProductQuickViewProvider({ children }: { children: React.ReactNode }) {
  const { cart, addItem } = useStore();
  const [slug, setSlug] = useState<string | null>(null);
  const [p, setP] = useState<ProductDetail | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);

  const open = useCallback(
    (s: string) => {
      setSlug(s);
      setP(null);
      setQty(1);
      setAdded(false);
      const sp = cart?.period ? `?start=${cart.period.start}&end=${cart.period.end}` : '';
      api<{ product: ProductDetail }>(`/api/catalog/products/${s}${sp}`)
        .then((r) => setP(r.product))
        .catch(() => setSlug(null));
    },
    [cart?.period],
  );

  const close = () => setSlug(null);

  const av = p?.availability?.status;
  const priceRows = p
    ? p.isConsumable
      ? [{ label: ti('prod.priceUnit'), value: p.dailyPrice }]
      : (
          [
            { label: ti('prod.priceDay'), value: p.dailyPrice },
            { label: ti('prod.priceWeek'), value: p.weekPrice },
            { label: ti('prod.priceMonth'), value: p.monthPrice },
          ] as { label: string; value: number | null }[]
        ).flatMap((r) => (r.value != null ? [{ label: r.label, value: r.value }] : []))
    : [];

  async function add() {
    if (!p) return;
    setBusy(true);
    try {
      await addItem(p.id, qty);
      setAdded(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <QuickViewContext.Provider value={{ open }}>
      {children}
      <Modal visible={!!slug} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(5,4,30,0.45)' }} onPress={close} />
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: '88%',
            backgroundColor: C.white,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingBottom: 30,
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.border }} />
          </View>
          <Pressable
            onPress={close}
            hitSlop={10}
            style={{ position: 'absolute', right: 14, top: 12, zIndex: 2, padding: 6 }}
          >
            <Ionicons name="close" size={24} color={C.muted} />
          </Pressable>

          {!p ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: C.muted }}>{ti('common.loading')}</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8 }}>
              <Image
                source={{
                  uri:
                    mediaUrl(p.image) ??
                    'https://placehold.co/600x400/eeeef7/08065d/png?text=BRICOLOC',
                }}
                style={{ width: '100%', height: 200, borderRadius: R.md, backgroundColor: C.surface2 }}
                resizeMode="contain"
              />
              {p.brand ? (
                <Text style={{ color: C.muted, fontWeight: '700', marginTop: 12, fontSize: 12 }}>
                  {p.brand.toUpperCase()}
                </Text>
              ) : null}
              <Text style={{ fontSize: 21, fontWeight: '900', color: C.locDeep, letterSpacing: -0.5, marginTop: 2 }}>
                {p.name}
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  borderRadius: R.sm,
                  backgroundColor: C.surface2,
                  overflow: 'hidden',
                  marginTop: 14,
                }}
              >
                {priceRows.map((row, i) => (
                  <View
                    key={row.label}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      paddingVertical: 12,
                      borderLeftWidth: i === 0 ? 0 : 1,
                      borderLeftColor: C.border,
                    }}
                  >
                    <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700' }}>{row.label}</Text>
                    <Text style={{ color: C.locDeep, fontWeight: '900', fontSize: 15, marginTop: 3 }}>
                      {formatEUR(row.value as number)}
                    </Text>
                  </View>
                ))}
              </View>

              {p.deposit > 0 ? (
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>
                  Caution : {formatEUR(p.deposit)}
                </Text>
              ) : null}
              {p.shortDescription || p.description ? (
                <Text style={{ color: C.ink, lineHeight: 20, marginTop: 12 }} numberOfLines={4}>
                  {p.shortDescription || p.description}
                </Text>
              ) : null}
              {av && av !== 'AVAILABLE' ? (
                <Text style={{ marginTop: 10, color: av === 'PARTIAL' ? C.warn : C.err, fontWeight: '700' }}>
                  {av === 'PARTIAL' ? 'Stock limité sur cette période' : 'Indisponible sur cette période'}
                </Text>
              ) : null}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1.5,
                    borderColor: C.border,
                    borderRadius: R.pill,
                  }}
                >
                  <Pressable onPress={() => setQty((q) => Math.max(1, q - 1))} style={{ padding: 12 }}>
                    <Ionicons name="remove" size={16} color={C.ink} />
                  </Pressable>
                  <Text style={{ fontWeight: '800', minWidth: 20, textAlign: 'center' }}>{qty}</Text>
                  <Pressable onPress={() => setQty((q) => q + 1)} style={{ padding: 12 }}>
                    <Ionicons name="add" size={16} color={C.ink} />
                  </Pressable>
                </View>
                <Pressable
                  onPress={add}
                  disabled={busy || av === 'UNAVAILABLE'}
                  style={{
                    flex: 1,
                    backgroundColor: av === 'UNAVAILABLE' ? C.border : C.brico,
                    borderRadius: R.pill,
                    paddingVertical: 15,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: C.white, fontWeight: '900', fontSize: 15 }}>
                    {busy ? '…' : `＋ ${ti('prod.book')}`}
                  </Text>
                </Pressable>
              </View>

              {added ? (
                <Pressable
                  onPress={() => {
                    close();
                    router.push('/(tabs)/panier');
                  }}
                  style={{ marginTop: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: C.locDeep, fontWeight: '800' }}>
                    ✓ Ajouté — voir le panier →
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    const s = slug;
                    close();
                    if (s) router.push(`/produit/${s}`);
                  }}
                  style={{ marginTop: 14, alignItems: 'center' }}
                >
                  <Text style={{ color: C.muted, fontWeight: '700' }}>Voir la fiche complète</Text>
                </Pressable>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </QuickViewContext.Provider>
  );
}

export function useQuickView(): Ctx {
  return useContext(QuickViewContext) ?? { open: (s) => router.push(`/produit/${s}`) };
}
