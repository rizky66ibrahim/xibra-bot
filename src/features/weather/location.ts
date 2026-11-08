export interface UserLocation {
  latitude: number;
  longitude: number;
  district?: string;
  city?: string;
  province?: string;
}

interface NominatimResponse {
  address?: {
    city_district?: string;
    suburb?: string;
    borough?: string;
    city?: string;
    town?: string;
    municipality?: string;
    county?: string;
    state?: string;
  };
}

const locations = new Map<number, UserLocation>();
const geocodeCache = new Map<
  string,
  Omit<UserLocation, "latitude" | "longitude">
>();

let requestQueue = Promise.resolve();
let lastRequestAt = 0;

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

export function getLocationLabel(userId: number): string {
  const location = getUserLocation(userId);

  if (!location) return "Location not yet set";

  if (location.district && location.city) {
    return `${location.district}, ${location.city}`;
  }

  return location.city || location.district || "Surrounding area";
}

export async function resolveLocationName(
  latitude: number,
  longitude: number,
): Promise<Omit<UserLocation, "latitude" | "longitude"> | null> {
  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;

  const cached = geocodeCache.get(key);
  if (cached) return cached;

  const task = requestQueue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastRequestAt));

    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }

    lastRequestAt = Date.now();

    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(latitude),
      lon: String(longitude),
      zoom: "18",
      addressdetails: "1",
    });

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${params}`,
        {
          headers: {
            "User-Agent": "XibraBot/1.0 (Weather Location Lookup)",
            "Accept-Language": "id",
          },
        },
      );

      if (!response.ok) return null;

      const data = (await response.json()) as NominatimResponse;
      const address = data.address;

      if (!address) return null;

      const district =
        address.city_district || address.suburb || address.borough;

      const city =
        address.city || address.town || address.county || address.municipality;

      const result = {
        district,
        city,
        province: address.state,
      };

      if (district || city) {
        geocodeCache.set(key, result);
        return result;
      }

      return null;
    } catch {
      return null;
    }
  });

  requestQueue = task.then(
    () => undefined,
    () => undefined,
  );

  return task;
}

export function updateUserLocationName(
  userId: number,
  latitude: number,
  longitude: number,
  details: Omit<UserLocation, "latitude" | "longitude">,
): void {
  const current = locations.get(userId);

  if (
    !current ||
    current.latitude !== latitude ||
    current.longitude !== longitude
  ) {
    return;
  }

  locations.set(userId, {
    ...current,
    ...details,
  });
}
