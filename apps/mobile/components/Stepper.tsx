import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '@/lib/theme';

export interface Step {
  key: string;
  label: string;
}

/**
 * Bandeau d'étapes du tunnel de commande (produit → dates → retrait →
 * identité → paiement). `currentIndex` = étape en cours ; tout ce qui
 * précède est marqué fait (✓), tout ce qui suit reste grisé.
 */
export function Stepper({ steps, currentIndex }: { steps: Step[]; currentIndex: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 22 }}>
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const isLast = i === steps.length - 1;
        return (
          <React.Fragment key={step.key}>
            <View style={{ alignItems: 'center', width: 64 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done || active ? C.brico : C.surface2,
                  borderWidth: active ? 2 : 0,
                  borderColor: C.bricoStrong,
                }}
              >
                {done ? (
                  <Ionicons name="checkmark" size={16} color={C.white} />
                ) : (
                  <Text style={{ color: active ? C.white : C.muted, fontWeight: '800', fontSize: 12.5 }}>
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 5,
                  fontSize: 10.5,
                  fontWeight: active ? '800' : '600',
                  color: active ? C.locDeep : done ? C.ink : C.muted,
                  textAlign: 'center',
                }}
              >
                {step.label}
              </Text>
            </View>
            {!isLast && (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: done ? C.brico : C.border,
                  marginTop: 13,
                  marginHorizontal: -6,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}
