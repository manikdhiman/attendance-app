// backend/src/utils/geo.js

// Replace these coordinates with your exact office GPS location
const OFFICE_LAT = 28.6280; // Example Delhi Office Latitude
const OFFICE_LNG = 77.2789; // Example Delhi Office Longitude
const ALLOWED_RADIUS_METERS = 100; // Allowed circle radius in meters

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radius of earth in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

function verifyOfficeLocation(userLat, userLng) {
  if (!userLat || !userLng) return { valid: false, distance: null };
  const distance = getDistanceFromLatLonInMeters(OFFICE_LAT, OFFICE_LNG, userLat, userLng);
  return {
    valid: distance <= ALLOWED_RADIUS_METERS,
    distance: Math.round(distance),
  };
}

module.exports = { verifyOfficeLocation, OFFICE_LAT, OFFICE_LNG };