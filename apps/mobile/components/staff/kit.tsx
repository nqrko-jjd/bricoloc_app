import { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '@/lib/theme';

export function StaffHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: C.loc,
      }}
    >
      {onBack && (
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </Pressable>
      )}
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', flex: 1 }}>{title}</Text>
    </View>
  );
}

export function StaffScreen({
  title,
  onBack,
  children,
  scroll = true,
}: {
  title: string;
  onBack?: () => void;
  children: ReactNode;
  scroll?: boolean;
}) {
  const back = onBack ?? (router.canGoBack() ? () => router.back() : undefined);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <StaffHeader title={title} onBack={back} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function BigButton({
  label,
  tone = 'navy',
  onPress,
  disabled,
}: {
  label: string;
  tone?: 'navy' | 'red' | 'outline' | 'ok';
  onPress: () => void;
  disabled?: boolean;
}) {
  const bg =
    tone === 'red' ? C.brico : tone === 'ok' ? C.ok : tone === 'outline' ? C.white : C.loc;
  const fg = tone === 'outline' ? C.ink : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: disabled ? C.border : bg,
        borderWidth: tone === 'outline' ? 1 : 0,
        borderColor: C.border,
        borderRadius: R.md,
        paddingVertical: 18,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: disabled ? C.muted : fg, fontWeight: '900', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export function ListRow({
  title,
  subtitle,
  right,
  image,
  onPress,
  style,
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  image?: string | null;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const Wrap: any = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 14,
          paddingHorizontal: 12,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        },
        style,
      ]}
    >
      {image !== undefined && (
        <View style={{ width: 46, height: 46, borderRadius: 10, backgroundColor: C.surface2, overflow: 'hidden' }}>
          {image ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Img uri={image} />
          ) : null}
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }} numberOfLines={2}>
          {title}
        </Text>
        {subtitle != null && (
          <Text style={{ color: C.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </Wrap>
  );
}

import { Image as RNImage } from 'react-native';
import { mediaUrl } from '@/lib/api';
function Img({ uri }: { uri: string }) {
  return (
    <RNImage
      source={{ uri: mediaUrl(uri) }}
      style={{ width: '100%', height: '100%' }}
      resizeMode="contain"
    />
  );
}

export function Pill({ text, tone = 'muted' }: { text: string; tone?: 'ok' | 'warn' | 'err' | 'muted' }) {
  const map = {
    ok: { bg: C.okBg, fg: C.ok },
    warn: { bg: C.warnBg, fg: C.warn },
    err: { bg: C.errBg, fg: C.err },
    muted: { bg: C.surface2, fg: C.muted },
  }[tone];
  return (
    <Text
      style={{
        backgroundColor: map.bg,
        color: map.fg,
        fontWeight: '800',
        fontSize: 13,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: R.pill,
        overflow: 'hidden',
      }}
    >
      {text}
    </Text>
  );
}
