export interface UserLocation {
  latitude: number;
  longitude: number;
}

const locations = new Map<number, UserLocation>();

export function saveUserLocation(
  userId: number,
  latitude: number,
  longitude: number,
): void {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Invalid location coordinates");
  }

  locations.set(userId, { latitude, longitude });
}

export function getUserLocation(userId: number): UserLocation | null {
  return locations.get(userId) ?? null;
}
