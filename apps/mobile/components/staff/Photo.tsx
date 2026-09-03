import { useState } from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mediaUrl } from '@/lib/api';
import { C } from '@/lib/theme';

/**
 * Photo produit pour l'espace équipe : grande vignette, tap = plein écran.
 */
export function Photo({ uri, height = 220 }: { uri?: string | null; height?: number }) {
  const [open, setOpen] = useState(false);
  const src = mediaUrl(uri || undefined);

  if (!src) {
    return (
      <View
        style={{
          width: '100%',
          height,
          borderRadius: 16,
          backgroundColor: C.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="image-outline" size={40} color={C.muted} />
        <Text style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>Pas de photo</Text>
      </View>
    );
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)}>
        <Image
          source={{ uri: src }}
          style={{ width: '100%', height, borderRadius: 16, backgroundColor: C.surface2 }}
          resizeMode="contain"
        />
        <View
          style={{
            position: 'absolute',
            right: 10,
            bottom: 10,
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderRadius: 999,
            padding: 6,
          }}
        >
          <Ionicons name="expand" size={16} color="#fff" />
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' }}
        >
          <Image source={{ uri: src }} style={{ width: '100%', height: '82%' }} resizeMode="contain" />
          <Text style={{ color: '#c9c8ec', textAlign: 'center', marginTop: 12, fontWeight: '700' }}>
            Toucher pour fermer
          </Text>
        </Pressable>
      </Modal>
    </>
  );
}
