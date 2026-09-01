import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { C } from '@/lib/theme';
import { formatDateTimeBE, inDays } from '@/lib/format';
import { Button } from './ui';

/**
 * Selecteur de periode sans dependance native : date de debut (J+n, 8h)
 * et duree en jours. Couvre les besoins de reservation courants.
 */
export function PeriodPicker({
  initial,
  onConfirm,
  confirmLabel = 'Appliquer ces dates',
}: {
  initial?: { start: string; end: string } | null;
  onConfirm: (p: { start: string; end: string }) => void;
  confirmLabel?: string;
}) {
  const now = new Date();
  const initStart = initial ? new Date(initial.start) : inDays(1, 8);
  const initDays = initial
    ? Math.max(1, Math.round((new Date(initial.end).getTime() - initStart.getTime()) / 86400000))
    : 2;
  const [offset, setOffset] = useState(
    Math.max(0, Math.round((initStart.getTime() - now.setHours(0, 0, 0, 0)) / 86400000)),
  );
  const [days, setDays] = useState(initDays);
  const [hour, setHour] = useState(initStart.getHours() || 8);

  const start = inDays(offset, hour);
  const end = new Date(start.getTime() + days * 86400000);
  end.setHours(18, 0, 0, 0);

  const Step = ({ label, onMinus, onPlus, value }: { label: string; onMinus: () => void; onPlus: () => void; value: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6 }}>
      <Text style={{ color: C.loc, fontWeight: '700' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={onMinus} style={btn}>
          <Text style={btnT}>−</Text>
        </Pressable>
        <Text style={{ minWidth: 90, textAlign: 'center' }}>{value}</Text>
        <Pressable onPress={onPlus} style={btn}>
          <Text style={btnT}>+</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View>
      <Step
        label="Début"
        value={offset === 0 ? "Aujourd'hui" : offset === 1 ? 'Demain' : `Dans ${offset} j`}
        onMinus={() => setOffset((o) => Math.max(0, o - 1))}
        onPlus={() => setOffset((o) => o + 1)}
      />
      <Step
        label="Heure de retrait"
        value={`${hour}h00`}
        onMinus={() => setHour((h) => Math.max(6, h - 1))}
        onPlus={() => setHour((h) => Math.min(19, h + 1))}
      />
      <Step
        label="Durée"
        value={days === 1 ? '1 jour' : `${days} jours`}
        onMinus={() => setDays((d) => Math.max(1, d - 1))}
        onPlus={() => setDays((d) => d + 1)}
      />
      <Text style={{ color: C.lightGray, fontSize: 13, marginVertical: 8 }}>
        {formatDateTimeBE(start)} → {formatDateTimeBE(end)}
      </Text>
      <Button
        title={confirmLabel}
        onPress={() => onConfirm({ start: start.toISOString(), end: end.toISOString() })}
      />
    </View>
  );
}

const btn = {
  backgroundColor: C.loc,
  width: 40,
  height: 40,
  borderRadius: 10,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
const btnT = { color: C.white, fontSize: 22, fontWeight: '800' as const };
