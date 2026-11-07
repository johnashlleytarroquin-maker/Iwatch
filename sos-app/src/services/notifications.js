import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform, Vibration } from 'react-native';
import { createAudioPlayer } from 'expo-audio';
import { api } from '../api';

let currentPlayer = null;

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
 * Plays the loud emergency alarm siren and pulses vibration.
 */
export async function setupNotificationChannels() {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('emergency-alerts', {
        name: 'Campus Emergency Dispatch Alerts',
        description: 'Urgent emergency dispatches and alarms for on-duty responders',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'emergency_alarm', // References res/raw/emergency_alarm.wav
        vibrationPattern: [0, 600, 200, 600, 200, 1000, 300],
        lightColor: '#DC2626',
        enableVibrate: true,
        showBadge: true,
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.ALARM,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        },
      });
    } catch (e) {
      console.warn('[notifications] Channel configuration note:', e.message);
    }
  }
}

/**
 * Play loud emergency siren alarm on responder devices using expo-audio.
 * Loops continuously until dismissed or accepted.
 */
export async function playEmergencyAlarmSound(user) {
  if (!user || user.role !== 'responder') return;

  try {
    await stopEmergencyAlarmSound();

    const player = createAudioPlayer(require('../../assets/emergency_alarm.mp3'));
    if (player) {
      player.loop = true;
      player.volume = 1.0;
      player.play();
      currentPlayer = player;
    }
  } catch (err) {
    console.warn('[notifications] Audio alarm playback notice:', err.message);
  }
}

/**
 * Stop any active emergency alarm audio playback.
 */
export async function stopEmergencyAlarmSound() {
  try {
    if (currentPlayer) {
      currentPlayer.pause();
      if (typeof currentPlayer.remove === 'function') {
        currentPlayer.remove();
      }
      currentPlayer = null;
    }
  } catch {}
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
    return null;
  }
}

/**
 * Vibrate phone ONLY for responder users.
 * Uses a looping emergency cadence that repeats until dismissed.
 */
export function triggerResponderVibration(user) {
  if (user && user.role === 'responder') {
    try {
      // Loop cadence: pause 0, buzz 600ms, pause 200ms, buzz 600ms, pause 200ms, buzz 1000ms, pause 400ms
      Vibration.vibrate([0, 600, 200, 600, 200, 1000, 400], true);
    } catch (e) {
      console.warn('[notifications] Vibration error:', e);
    }
  }
}

/**
 * Stop any active vibration on the responder device.
 */
export function stopResponderVibration() {
  try {
    Vibration.cancel();
  } catch {}
}

/**
 * Present an immediate local notification (used when socket receives an emergency alert).
 * Plays the emergency sound and triggers vibration on responder devices.
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
        sound: 'emergency_alarm',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 600, 200, 600, 200, 1000, 400],
      },
      trigger: null, // instant
    }).catch(() => {});
  } catch (e) {
    console.warn('[notifications] Failed to present emergency notification:', e);
  }
}
