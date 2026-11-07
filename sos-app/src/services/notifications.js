import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform, Vibration } from 'react-native';
import { api } from '../api';

// Handle notification display while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Configure high-priority emergency channel for Android.
 * Essential for heads-up alerts and vibration.
 */
export async function setupNotificationChannels() {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('emergency-alerts', {
        name: 'Campus Emergency Dispatch Alerts',
        description: 'Urgent emergency dispatches and alarms for on-duty responders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 600, 200, 600, 200, 1000],
        lightColor: '#DC2626',
        enableVibrate: true,
        showBadge: true,
      });
    } catch (e) {
      console.warn('[notifications] Channel configuration note:', e.message);
    }
  }
}

/**
 * Registers the device's push token with the backend server.
 * ONLY registers for users with role === 'responder'.
 */
export async function registerResponderPushToken(user) {
  try {
    if (!user || user.role !== 'responder') {
      return null;
    }

    await setupNotificationChannels().catch(() => {});

    // In Expo Go on Android (SDK 53+), Expo removed remote FCM push support.
    // We check and gracefully avoid the warning/rejection while in Expo Go.
    const isExpoGo =
      Constants.appOwnership === 'expo' ||
      Constants.executionEnvironment === 'storeClient';

    if (isExpoGo && Platform.OS === 'android') {
      console.log(
        '[notifications] Expo Go detected: Remote push is disabled in Expo Go on Android. Realtime socket alerts, local notifications, and responder vibration are active.'
      );
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    // Retrieve Expo Push Token for Standalone APK / Dev Client builds
    const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
    const pushToken = tokenData?.data;
    if (pushToken) {
      await api.post('/api/me/push-token', { pushToken }).catch(() => {});
      console.log('[notifications] Responder push token registered with server');
    }
    return pushToken;
  } catch (err) {
    // Fail silently in development
    return null;
  }
}

/**
 * Vibrate phone ONLY for responder users.
 * Uses a distinct emergency alarm vibration cadence.
 */
export function triggerResponderVibration(user) {
  if (user && user.role === 'responder') {
    try {
      // Urgent cadence: pause 0, buzz 600ms, pause 200ms, buzz 600ms, pause 200ms, buzz 1000ms
      Vibration.vibrate([0, 600, 200, 600, 200, 1000, 200, 1000]);
    } catch (e) {
      console.warn('[notifications] Vibration error:', e);
    }
  }
}

/**
 * Present an immediate local notification (used when socket receives an emergency alert)
 * ONLY executed if user is an on-duty responder.
 */
export async function presentEmergencyNotification(report, user) {
  if (!user || user.role !== 'responder') return;

  try {
    const typeUpper = String(report.type || 'EMERGENCY').toUpperCase();
    const studentName = report.studentName || 'Student';
    const loc = report.locationText ? ` at ${report.locationText}` : '';
    const note = report.note ? `\n"${report.note}"` : '';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🚨 EMERGENCY: ${typeUpper} ALERT!`,
        body: `${studentName} requested immediate SOS assistance${loc}.${note}`,
        data: { reportId: report.id, type: report.type },
        channelId: 'emergency-alerts',
      },
      trigger: null, // instant
    }).catch(() => {});

    triggerResponderVibration(user);
  } catch (e) {
    console.warn('[notifications] Failed to present emergency notification:', e);
  }
}
