import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { C } from '@/lib/theme';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setActive(true);
      busy.current = false;
      return () => setActive(false);
    }, []),
  );

  async function onScan(data: string) {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    const code = data.trim();
    try {
      // Réservation ? (recherche publique par QR / numéro)
      const look = await api<{ reservation?: { number: string } }>('/api/public/reservation/lookup', {
        method: 'POST',
        body: { token: code },
      }).catch(() => null);
      if (look?.reservation) {
        const mine = await api<{ reservations: { id: string; number: string }[] }>(
          '/api/reservations',
        ).catch(() => ({ reservations: [] as { id: string; number: string }[] }));
        const found = mine.reservations.find((x) => x.number === look.reservation!.number);
        router.replace(found ? `/reservation/${found.id}` : '/(tabs)/reservations');
        return;
      }

      // Produit ? (slug)
      const prod = await api<{ product?: { slug: string } }>(
        `/api/catalog/products/${encodeURIComponent(code.toLowerCase())}`,
      ).catch(() => null);
      if (prod?.product) {
        router.replace(`/produit/${prod.product.slug}`);
        return;
      }

      setError(t('scan.notFound'));
      busy.current = false;
    } catch {
      setError(t('scan.notFound'));
      busy.current = false;
    }
  }

  if (!permission) return <SafeAreaView style={styles.center} />;
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.hint}>{t('scan.permission')}</Text>
        <Button title={t('scan.title')} onPress={requestPermission} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.wrap}>
      {active && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'code128', 'ean13', 'code39', 'datamatrix'],
          }}
          onBarcodeScanned={({ data }) => onScan(data)}
        />
      )}
      <SafeAreaView style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.hint}>{t('scan.hint')}</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <Button title="Fermer" variant="ghost" onPress={() => router.back()} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: C.bg },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  frame: { width: 240, height: 240, borderColor: '#fff', borderWidth: 3, borderRadius: 20 },
  hint: { color: '#fff', textAlign: 'center', fontSize: 15, textShadowColor: '#000', textShadowRadius: 6 },
  error: { color: C.brico, backgroundColor: '#fff', padding: 10, borderRadius: 8, fontWeight: '700' },
});
