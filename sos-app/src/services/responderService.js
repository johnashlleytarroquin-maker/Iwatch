import { NativeModules, Platform } from 'react-native';
import { API_URL } from '../config';

const { ResponderAlertModule } = NativeModules;

/**
 * Interface to native Android 24/7 Foreground Service.
 * Keeps responder devices actively monitoring for campus emergency dispatches
 * even when the app is completely closed or screen is locked.
 */
export const ResponderService = {
  start: async (token) => {
    if (Platform.OS === 'android' && ResponderAlertModule?.startService && token) {
      try {
        await ResponderAlertModule.startService(token, API_URL);
        console.log('[ResponderService] Started 24/7 background responder monitoring');
      } catch (e) {
        console.warn('[ResponderService] Failed to start background service:', e.message);
      }
    }
  },

  stop: async () => {
    if (Platform.OS === 'android' && ResponderAlertModule?.stopService) {
      try {
        await ResponderAlertModule.stopService();
        console.log('[ResponderService] Stopped background responder monitoring');
      } catch (e) {
        console.warn('[ResponderService] Failed to stop background service:', e.message);
      }
    }
  },

  silence: async () => {
    if (Platform.OS === 'android' && ResponderAlertModule?.silenceAlarm) {
      try {
        await ResponderAlertModule.silenceAlarm();
      } catch (e) {
        console.warn('[ResponderService] Failed to silence alarm:', e.message);
      }
    }
  },
};
