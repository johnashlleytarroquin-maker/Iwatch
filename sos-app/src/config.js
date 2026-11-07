import Constants from 'expo-constants';

// Live cloud backend on Render (accessible from anywhere: 4G/5G cellular data or Wi-Fi):
const CLOUD_API_URL = 'https://iwatch-api-qj2e.onrender.com';

// In local Expo Go development, hostUri points to your computer.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || (devHost ? `http://${devHost}:3000` : CLOUD_API_URL);

// Shown on the student screen as a "call now" button. Change to your school's security line / local number.
export const EMERGENCY_NUMBER = '911';
