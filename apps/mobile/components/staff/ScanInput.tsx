import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '@/lib/theme';

/**
 * Saisie de scan pour l'espace équipe.
 *
 * - **Lecteur physique Zebra** (DataWedge « Keystroke output ») : le code est
 *   « tapé » dans le champ toujours focus. On valide de deux façons, au choix :
 *     • sur la touche Entrée finale si DataWedge en envoie une (`onSubmitEditing`) ;
 *     • sinon par **détection de rafale** : les caractères d'un scan arrivent
 *       très vite (< ~110 ms), donc dès que ça se stabilise on valide tout seul.
 *   → fonctionne que le suffixe Entrée soit configuré ou non.
 * - **Bouton caméra** : lecture QR / code-barres via expo-camera (tel/tablette).
 * - **Bouton clavier** : saisie manuelle d'un code (pas de validation auto).
 */
const BURST_GAP_MS = 110;

export function ScanInput({ onScan, hint }: { onScan: (code: string) => void; hint?: string }) {
  const inputRef = useRef<TextInput>(null);
  const [value, setValue] = useState('');
  const [manual, setManual] = useState(false);
  const [cam, setCam] = useState(false);
  const [perm, requestPerm] = useCameraPermissions();
  const camBusy = useRef(false);

  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCode = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  // Garde le champ focus pour le lecteur physique.
  useEffect(() => {
    if (manual || cam) return;
    inputRef.current?.focus();
    const id = setInterval(() => {
      if (!inputRef.current?.isFocused()) inputRef.current?.focus();
    }, 400);
    return () => clearInterval(id);
  }, [manual, cam]);

  useEffect(
    () => () => {
      if (burstTimer.current) clearTimeout(burstTimer.current);
    },
    [],
  );

  function submit(raw: string) {
    if (burstTimer.current) {
      clearTimeout(burstTimer.current);
      burstTimer.current = null;
    }
    const code = raw.replace(/[\r\n\t]/g, '').trim();
    setValue('');
    if (!manual) inputRef.current?.focus();
    if (code.length < 2) return;
    // Anti-doublon : lecteur qui envoie ET la rafale ET l'Entrée.
    const now = Date.now();
    if (code === lastCode.current.code && now - lastCode.current.at < 900) return;
    lastCode.current = { code, at: now };
    onScan(code);
  }

  function onChange(text: string) {
    setValue(text);
    // Entrée / tab au milieu du flux = fin de code.
    if (/[\r\n\t]/.test(text)) {
      submit(text);
      return;
    }
    if (manual) return; // saisie humaine : pas d'auto-validation
    if (burstTimer.current) clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => {
      burstTimer.current = null;
      submit(text);
    }, BURST_GAP_MS);
  }

  async function openCam() {
    if (!perm?.granted) {
      const res = await requestPerm();
      if (!res.granted) return;
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
        onChangeText={onChange}
        onSubmitEditing={(e) => submit(e.nativeEvent.text)}
        onBlur={() => {
          if (!manual && !cam) setTimeout(() => inputRef.current?.focus(), 50);
        }}
        placeholder={manual ? 'Taper un code…' : hint || 'Prêt à scanner — visez et pressez la gâchette'}
        placeholderTextColor={C.muted}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        blurOnSubmit={false}
        showSoftInputOnFocus={manual}
        caretHidden={!manual}
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
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'datamatrix'] }}
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
