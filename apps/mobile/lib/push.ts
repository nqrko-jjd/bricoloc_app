import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Enregistre le token de push Expo cote API BRICOLOC.
 * Fonctionne sur appareil physique (Expo Go ou build de dev/prod).
 */
export async function registerForPush(): Promise<void> {
  const settings = await Notifications.getPermissionsAsync();
  let status = settings.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'BRICOLOC',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  await api('/api/account/push-tokens', {
    method: 'POST',
    body: { token: tokenData.data, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
  });
}
