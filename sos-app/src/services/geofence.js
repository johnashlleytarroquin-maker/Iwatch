import { CAMPUS_CONFIG } from '../config';

/**
 * Haversine formula to compute distance between two GPS coordinates in meters.
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number'
  ) {
    return 0;
  }
  const R = 6371000; // Earth mean radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Format meter distance to human-readable string (e.g. "240 m" or "1.8 km").
 */
export function formatDistance(meters) {
  if (meters == null || isNaN(meters)) return 'Unknown';
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Check if the user is currently inside the SNSU Main Campus 500m geofence boundary.
 *
 * @param {object|null} coords - { lat: number, lng: number }
 * @param {boolean} simulateInside - When true, simulates presence on campus for thesis demos.
 * @returns {object} Geofence status result
 */
export function checkCampusGeofence(coords, simulateInside = false) {
  if (simulateInside) {
    return {
      isInsideCampus: true,
      distanceMeters: 65,
      distanceFormatted: '65 m',
      campus: CAMPUS_CONFIG,
      coords: { lat: CAMPUS_CONFIG.latitude, lng: CAMPUS_CONFIG.longitude },
      simulated: true,
    };
  }

  if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
    return {
      isInsideCampus: true, // Default to true while GPS is acquiring to allow initial UI
      distanceMeters: 0,
      distanceFormatted: 'Detecting...',
      campus: CAMPUS_CONFIG,
      coords: null,
      simulated: false,
    };
  }

  const distance = calculateDistanceMeters(
    coords.lat,
    coords.lng,
    CAMPUS_CONFIG.latitude,
    CAMPUS_CONFIG.longitude
  );

  const isInside = distance <= CAMPUS_CONFIG.radiusMeters;

  return {
    isInsideCampus: isInside,
    distanceMeters: distance,
    distanceFormatted: formatDistance(distance),
    campus: CAMPUS_CONFIG,
    coords,
    simulated: false,
  };
}
