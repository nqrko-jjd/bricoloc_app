import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { C, R } from '@/lib/theme';
import { Field } from '@/components/ui';

export interface AddressPick {
  line1: string;
  postalCode: string;
  city: string;
}
interface Suggestion extends AddressPick {
  label: string;
}

/** Champ « Adresse » avec propositions de rues (OpenStreetMap via /api/geo/autocomplete). */
export function AddressField({
  value,
  onChangeText,
  onPick,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onPick: (a: AddressPick) => void;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const picked = useRef(false);

  useEffect(() => {
    if (picked.current) {
      picked.current = false;
      return;
    }
    const term = value.trim();
    if (term.length < 3) {
      setItems([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await api<{ suggestions: Suggestion[] }>(
          `/api/geo/autocomplete?q=${encodeURIComponent(term)}`,
        );
        setItems(r.suggestions);
        setOpen(true);
      } catch {
        /* ignore */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <View>
      <Field
        label="Adresse"
        value={value}
        onChangeText={(v) => {
          onChangeText(v);
          setOpen(true);
        }}
        placeholder="Commencez à taper la rue…"
      />
      {open && items.length > 0 && (
        <View
          style={{
            marginTop: -6,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: R.sm,
            backgroundColor: C.white,
            overflow: 'hidden',
          }}
        >
          {items.map((s, i) => (
            <Pressable
              key={s.label + i}
              onPress={() => {
                picked.current = true;
                onChangeText(s.line1);
                onPick({ line1: s.line1, postalCode: s.postalCode, city: s.city });
                setItems([]);
                setOpen(false);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: C.border,
              }}
            >
              <Ionicons name="location-outline" size={16} color={C.muted} />
              <Text style={{ flex: 1, color: C.ink }}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
