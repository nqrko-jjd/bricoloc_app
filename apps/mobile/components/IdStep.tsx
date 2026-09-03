import { Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, TOKEN_KEY } from '@/lib/api';
import { C } from '@/lib/theme';
import { P, Button, Badge } from '@/components/ui';

/**
 * Pièce d'identité (recto) : prise de photo / galerie -> upload.
 * S'appuie sur `user.idDocStatus`. `onDone` doit recharger l'utilisateur.
 */
export function IdStep({
  user,
  busy,
  setBusy,
  setErr,
  onDone,
}: {
  user: { idDocStatus?: string; idDocReviewNote?: string | null } | null;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setErr: (s: string) => void;
  onDone: () => Promise<void> | void;
}) {
  const status = user?.idDocStatus ?? 'NONE';

  async function send(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setErr('Accès refusé');
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] });
    if (res.canceled || !res.assets?.[0]) return;
    setBusy(true);
    setErr('');
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const fd = new FormData();
      fd.append('file', {
        uri: res.assets[0].uri,
        name: 'carte-identite.jpg',
        type: 'image/jpeg',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      const up = await fetch(`${API_URL}/api/account/id-document`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!up.ok) {
        const j = await up.json().catch(() => null);
        throw new Error(j?.error?.message ?? 'Envoi impossible');
      }
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      {status === 'VERIFIED' && <Badge text="Carte d’identité vérifiée" tone="ok" />}
      {status === 'PENDING' && (
        <Badge text="Carte reçue — validation en cours. Vous pouvez continuer." tone="warn" />
      )}
      {status === 'REJECTED' && (
        <Badge
          text={`Photo refusée${user?.idDocReviewNote ? ` : ${user.idDocReviewNote}` : ''}. Renvoyez-en une nette.`}
          tone="warn"
        />
      )}
      {status === 'NONE' && (
        <P muted>
          Photo du recto de la carte d’identité de la personne qui commande (caution &amp; contrat).
        </P>
      )}
      {status !== 'VERIFIED' && (
        <>
          <Button
            title={status === 'NONE' ? 'Prendre en photo' : 'Reprendre la photo'}
            loading={busy}
            onPress={() => send(true)}
          />
          <Button title="Choisir dans la galerie" variant="ghost" onPress={() => send(false)} />
        </>
      )}
      <Text style={{ color: C.lightGray, fontSize: 11 }}>
        Document confidentiel, réservé à l’équipe Bricoloc, supprimé après la location.
      </Text>
    </View>
  );
}
