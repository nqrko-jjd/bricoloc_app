import React from 'react';
import {
  ActivityIndicator,
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
import { C } from '@/lib/theme';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
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

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <Text style={{ fontWeight: '800', fontSize: size }}>
      <Text style={{ color: C.brico }}>BRICO</Text>
      <Text style={{ color: C.loc }}>LOC</Text>
    </Text>
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

export const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', color: C.loc, marginBottom: 8 },
  h2: { fontSize: 18, fontWeight: '800', color: C.loc, marginVertical: 8 },
  p: { fontSize: 14, color: C.darkGray, lineHeight: 20 },
  card: {
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 12,
  },
  btn: {
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
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
