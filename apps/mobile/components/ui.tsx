import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  type RefreshControlProps,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C } from '@/lib/theme';
import { mediaUrl } from '@/lib/api';
import { formatEUR } from '@/lib/format';

export interface ProductMini {
  slug: string;
  name: string;
  image?: string | null;
  dailyPrice: number;
  rating?: { avg: number; count: number } | null;
}

export function Screen({
  children,
  scroll = true,
  refreshing,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: React.ReactElement<RefreshControlProps>;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.white }} edges={['top']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshing}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: 16 }}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Logo({ size = 22, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View
        style={{
          width: size * 1.2,
          height: size * 1.2,
          borderRadius: 6,
          backgroundColor: C.brico,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 6,
        }}
      >
        <Text style={{ color: C.white, fontWeight: '900', fontSize: size * 0.85 }}>B</Text>
      </View>
      <Text style={{ fontWeight: '900', fontSize: size, letterSpacing: -0.5 }}>
        <Text style={{ color: C.brico }}>BRICO</Text>
        <Text style={{ color: onDark ? C.white : C.locDeep }}>LOC</Text>
      </Text>
    </View>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}
export function H2({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}
export function P({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <Text style={[styles.p, muted && { color: C.lightGray }]}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
}) {
  const bg =
    variant === 'primary'
      ? C.brico
      : variant === 'secondary'
        ? C.loc
        : 'transparent';
  const fg = variant === 'outline' || variant === 'ghost' ? C.loc : C.white;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'outline' && { borderWidth: 2, borderColor: C.loc },
        variant === 'ghost' && { borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  ...props
}: { label: string } & TextInputProps) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={C.lightGray}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

export function Badge({
  text,
  tone = 'neutral',
}: {
  text: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'err';
}) {
  const map = {
    neutral: { bg: '#EEF0F3', fg: C.loc },
    ok: { bg: C.okBg, fg: C.ok },
    warn: { bg: C.warnBg, fg: C.warn },
    err: { bg: C.errBg, fg: C.err },
  }[tone];
  return (
    <View style={{ backgroundColor: map.bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: map.fg, fontWeight: '700', fontSize: 12 }}>{text}</Text>
    </View>
  );
}

/** Carte produit compacte (accueil / grille catalogue) — style concept. */
export function ProductMiniCard({
  p,
  width,
}: {
  p: ProductMini;
  width?: import('react-native').DimensionValue;
}) {
  return (
    <Link href={`/produit/${p.slug}`} asChild>
      <Pressable
        style={{
          width: width ?? '47%',
          backgroundColor: C.white,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: C.border,
          overflow: 'hidden',
        }}
      >
        <View style={{ height: 120, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' }}>
          <Image
            source={{ uri: mediaUrl(p.image) ?? 'https://placehold.co/200x150/eeeef7/08065d/png?text=BRICOLOC' }}
            style={{ width: '86%', height: '86%' }}
            resizeMode="contain"
          />
          <View
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: C.white,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="heart-outline" size={15} color={C.muted} />
          </View>
        </View>
        <View style={{ padding: 12, gap: 3 }}>
          <Text style={{ fontWeight: '800', color: C.ink, fontSize: 14 }} numberOfLines={1}>
            {p.name}
          </Text>
          <Text style={{ fontWeight: '900', color: C.ink, fontSize: 15 }}>
            {formatEUR(p.dailyPrice)}
            <Text style={{ fontWeight: '600', color: C.muted, fontSize: 11 }}> / jour</Text>
          </Text>
          {p.rating && p.rating.count > 0 ? (
            <Text style={{ color: C.muted, fontSize: 11 }}>
              ★ {p.rating.avg.toFixed(1)} ({p.rating.count})
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

export const styles = StyleSheet.create({
  h1: { fontSize: 27, fontWeight: '900', color: C.locDeep, marginBottom: 8, letterSpacing: -0.6 },
  h2: { fontSize: 19, fontWeight: '900', color: C.locDeep, marginVertical: 8, letterSpacing: -0.4 },
  p: { fontSize: 14, color: C.darkGray, lineHeight: 21 },
  card: {
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 12,
  },
  btn: {
    borderRadius: 999,
    paddingVertical: 15,
    paddingHorizontal: 22,
    alignItems: 'center',
    marginVertical: 4,
  },
  label: {
    fontWeight: '700',
    fontSize: 12,
    color: C.loc,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: C.white,
    color: C.darkGray,
  },
});
