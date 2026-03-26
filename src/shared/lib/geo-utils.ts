/**
 * Haversine formula to calculate the distance between two points on Earth
 * Returns distance in meters
 */
export function getDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Checks if a coordinate is within a specified radius of a store
 */
export function isWithinRadius(
  storeLat: number | null | undefined,
  storeLon: number | null | undefined,
  currentLat: number,
  currentLon: number,
  radiusMeters: number = 200
): boolean {
  if (storeLat === null || storeLat === undefined || storeLon === null || storeLon === undefined) {
    // If store location is not set, we allow it (or we could choose to deny it)
    // For HR safety, we'll allow it but maybe log it in the future
    return true;
  }

  const distance = getDistanceInMeters(storeLat, storeLon, currentLat, currentLon);
  return distance <= radiusMeters;
}