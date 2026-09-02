import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '@/lib/theme';

/**
 * Saisie de scan pour l'espace équipe.
 * - Lecteur physique Zebra (DataWedge « Keystroke output » + suffixe Entrée) :
 *   tape dans le champ toujours focus -> onSubmitEditing.
 * - Bouton caméra : lecture QR / code-barres via expo-camera.
 * - Bouton clavier : saisie manuelle d'un code.
 */
export function ScanInput({ onScan, hint }: { onScan: (code: string) => void; hint?: string }) {
  const inputRef = useRef<TextInput>(null);
  const [value, setValue] = useState('');
  const [manual, setManual] = useState(false);
  const [cam, setCam] = useState(false);
  const [perm, requestPerm] = useCameraPermissions();
  const camBusy = useRef(false);

  // Garde le focus pour le lecteur physique.
  useEffect(() => {
    if (manual || cam) return;
    const id = setInterval(() => {
      if (!inputRef.current?.isFocused()) inputRef.current?.focus();
    }, 800);
    inputRef.current?.focus();
    return () => clearInterval(id);
  }, [manual, cam]);

  function submit(v: string) {
    const code = v.trim();
    setValue('');
    if (code.length >= 2) onScan(code);
    if (!manual) inputRef.current?.focus();
  }

  async function openCam() {
    if (!perm?.granted) {
      const r = await requestPerm();
      if (!r.granted) return;
    }
    camBusy.current = false;
    setCam(true);
  }

  return (
    <View style={styles.bar}>
      <Ionicons name="barcode-outline" size={22} color={C.loc} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={(e) => submit(e.nativeEvent.text)}
        placeholder={manual ? 'Taper un code…' : hint || 'Scanner'}
        placeholderTextColor={C.muted}
        autoCapitalize="characters"
        autoCorrect={false}
        blurOnSubmit={false}
        showSoftInputOnFocus={manual}
        returnKeyType="done"
        style={styles.input}
      />
      <Pressable onPress={() => setManual((m) => !m)} hitSlop={8} style={styles.iconBtn}>
        <Ionicons name={manual ? 'close' : 'create-outline'} size={20} color={C.loc} />
      </Pressable>
      <Pressable onPress={openCam} hitSlop={8} style={styles.iconBtn}>
        <Ionicons name="camera-outline" size={20} color={C.loc} />
      </Pressable>

      <Modal visible={cam} animationType="slide" onRequestClose={() => setCam(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'ean13', 'code39', 'datamatrix'] }}
            onBarcodeScanned={({ data }) => {
              if (camBusy.current) return;
              camBusy.current = true;
              setCam(false);
              submit(data);
            }}
          />
          <View style={styles.camOverlay}>
            <View style={styles.frame} />
            <Text style={styles.camHint}>Visez le QR ou le code-barres</Text>
            <Pressable onPress={() => setCam(false)} style={styles.camClose}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  input: { flex: 1, fontSize: 16, color: C.ink, paddingVertical: 12 },
  iconBtn: { padding: 6 },
  camOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22, padding: 24 },
  frame: { width: 240, height: 240, borderColor: '#fff', borderWidth: 3, borderRadius: 20 },
  camHint: { color: '#fff', fontSize: 15, textShadowColor: '#000', textShadowRadius: 6 },
  camClose: { backgroundColor: C.loc, borderRadius: R.pill, paddingHorizontal: 24, paddingVertical: 12 },
});
