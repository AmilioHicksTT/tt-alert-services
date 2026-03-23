import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { authApi } from './api';

// expo-notifications removed Android push support from Expo Go in SDK 53.
// Skip all notification setup when running inside Expo Go.
const isExpoGo = Constants.appOwnership === 'expo';

// Only set up the notification handler when NOT in Expo Go
if (!isExpoGo) {
  const Notifications = require('expo-notifications') as any;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (isExpoGo) {
    console.log('[Notifications] Skipped — not supported in Expo Go');
    return null;
  }

  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return null;
  }

  const Notifications = require('expo-notifications') as any;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission denied');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('tt_alerts', {
      name: 'T&T Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#C8102E',
      sound: 'alert.wav',
    });

    await Notifications.setNotificationChannelAsync('reports', {
      name: 'Citizen Reports',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // Use native FCM/APNs token (not Expo token) — backend sends via Firebase Admin SDK
  const token = (await Notifications.getDevicePushTokenAsync()).data;

  try {
    await authApi.updateProfile({ fcm_token: token });
  } catch {}

  return token;
}

export function useNotificationListeners(
  onNotification: (n: any) => void,
  onResponse: (r: any) => void
): () => void {
  if (isExpoGo) {
    return () => {}; // no-op cleanup in Expo Go
  }

  const Notifications = require('expo-notifications') as any;
  const notifListener = Notifications.addNotificationReceivedListener(onNotification);
  const responseListener = Notifications.addNotificationResponseReceivedListener(onResponse);
  return () => {
    notifListener.remove();
    responseListener.remove();
  };
}
