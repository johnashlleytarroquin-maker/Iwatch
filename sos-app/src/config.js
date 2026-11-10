import Constants from 'expo-constants';

// Live cloud backend on Render (accessible from anywhere: 4G/5G cellular data or Wi-Fi):
const CLOUD_API_URL = 'https://iwatch-api-qj2e.onrender.com';

// In local Expo Go development, hostUri points to your computer.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || (devHost ? `http://${devHost}:3000` : CLOUD_API_URL);

// Off-campus national emergency hotline:
export const EMERGENCY_NUMBER = '911';

// Surigao del Norte State University (SNSU) Main Campus Geofence Configuration
export const CAMPUS_CONFIG = {
  name: 'Surigao del Norte State University - Main Campus',
  shortName: 'SNSU Main Campus',
  address: 'Narciso Street, Surigao City, Surigao del Norte',
  latitude: 9.78724,
  longitude: 125.49437,
  radiusMeters: 200, // 200-meter radius boundary
  emergencyHotline: '911',
};
