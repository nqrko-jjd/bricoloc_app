import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '@/lib/theme';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function startOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
/** Lundi = 0 ... Dimanche = 6 (comme l'en-tête L M M J V S D). */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export interface DateRangePickerProps {
  visible: boolean;
  initialStart?: string | null;
  initialEnd?: string | null;
  onClose: () => void;
  onConfirm: (range: { start: string; end: string }) => void;
}

/**
 * Calendrier pleine page en bas de l'écran : on touche une date de départ puis
 * une date de retour, la plage se surligne. Retrait par défaut à 8h, retour à
 * 18h (comme le site) — pas de sélecteur d'heure séparé, on garde ça simple.
 */
export function DateRangePicker({ visible, initialStart, initialEnd, onClose, onConfirm }: DateRangePickerProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [rangeStart, setRangeStart] = useState<Date | null>(initialStart ? startOfDay(new Date(initialStart)) : null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(initialEnd ? startOfDay(new Date(initialEnd)) : null);
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const base = initialStart ? new Date(initialStart) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  function pickDay(d: Date) {
    if (d < today) return;
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(d);
      setRangeEnd(null);
      return;
    }
    if (d < rangeStart) {
      setRangeStart(d);
      setRangeEnd(null);
    } else {
      setRangeEnd(d);
    }
  }

  const days = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const first = new Date(year, month, 1);
    const total = daysInMonth(year, month);
    const leading = mondayIndex(first);
    const cells: (Date | null)[] = Array(leading).fill(null);
    for (let day = 1; day <= total; day++) cells.push(new Date(year, month, day));
    return cells;
  }, [viewMonth]);

  const canGoPrev = addMonths(viewMonth, -1) >= new Date(today.getFullYear(), today.getMonth(), 1);
  // Convention identique au site : la durée facturée = nb de jours entre
  // retrait et retour (pas le compte inclusif des cases du calendrier).
  const nights = rangeStart && rangeEnd ? Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000)) : 0;

  function confirm() {
    if (!rangeStart || !rangeEnd) return;
    const start = new Date(rangeStart);
    start.setHours(8, 0, 0, 0);
    const end = new Date(rangeEnd);
    end.setHours(18, 0, 0, 0);
    onConfirm({ start: start.toISOString(), end: end.toISOString() });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(5,4,30,0.45)' }} onPress={onClose} />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '86%',
          backgroundColor: C.white,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingBottom: 26,
        }}
      >
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.border }} />
        </View>
        <Pressable onPress={onClose} hitSlop={10} style={{ position: 'absolute', right: 14, top: 12, zIndex: 2, padding: 6 }}>
          <Ionicons name="close" size={24} color={C.muted} />
        </Pressable>

        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 10 }}>
          <Text style={{ fontSize: 19, fontWeight: '900', color: C.locDeep, letterSpacing: -0.4 }}>
            Choisissez vos dates
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }}>
            <Pressable
              onPress={() => canGoPrev && setViewMonth((m) => addMonths(m, -1))}
              disabled={!canGoPrev}
              style={{ padding: 8, opacity: canGoPrev ? 1 : 0.3 }}
            >
              <Ionicons name="chevron-back" size={20} color={C.locDeep} />
            </Pressable>
            <Text style={{ fontWeight: '800', color: C.locDeep, fontSize: 15 }}>
              {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </Text>
            <Pressable onPress={() => setViewMonth((m) => addMonths(m, 1))} style={{ padding: 8 }}>
              <Ionicons name="chevron-forward" size={20} color={C.locDeep} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', marginTop: 14 }}>
            {WEEKDAYS.map((w, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ color: C.muted, fontWeight: '700', fontSize: 12 }}>{w}</Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
            {days.map((d, i) => {
              if (!d) return <View key={i} style={{ width: `${100 / 7}%`, height: 42 }} />;
              const disabled = d < today;
              const isStart = rangeStart && sameDay(d, rangeStart);
              const isEnd = rangeEnd && sameDay(d, rangeEnd);
              const inRange = rangeStart && rangeEnd && d > rangeStart && d < rangeEnd;
              const edge = isStart || isEnd;
              return (
                <View key={i} style={{ width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' }}>
                  <Pressable
                    onPress={() => pickDay(d)}
                    disabled={disabled}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: edge ? 18 : inRange ? 0 : 18,
                      backgroundColor: edge ? C.brico : inRange ? C.redTint : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: disabled ? C.border : edge ? C.white : inRange ? C.brico : C.ink,
                        fontWeight: edge ? '800' : '600',
                        fontSize: 13,
                      }}
                    >
                      {d.getDate()}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <View
            style={{
              marginTop: 20,
              backgroundColor: C.surface2,
              borderRadius: R.md,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: C.locDeep, fontWeight: '700', fontSize: 13.5 }}>
              {rangeStart && rangeEnd
                ? `${rangeStart.getDate()} → ${rangeEnd.getDate()} ${MONTHS[rangeEnd.getMonth()].toLowerCase()} · ${nights} jour${nights > 1 ? 's' : ''}`
                : rangeStart
                  ? 'Choisissez la date de retour'
                  : 'Choisissez la date de retrait'}
            </Text>
          </View>

          <Pressable
            onPress={confirm}
            disabled={!rangeStart || !rangeEnd}
            style={{
              marginTop: 16,
              backgroundColor: rangeStart && rangeEnd ? C.brico : C.border,
              borderRadius: R.pill,
              paddingVertical: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: C.white, fontWeight: '900', fontSize: 15 }}>Confirmer les dates</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
