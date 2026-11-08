import { parseOpenMeteo, type Weather } from "./render.js";

const CACHE_MS = 10 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 60 * 1000;
const TIMEOUT_MS = 8_000;

interface WeatherCache {
  at: number;
  value: Weather;
}

const cache = new Map<string, WeatherCache>();
const failures = new Map<string, number>();

function locationKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

function buildUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
    hourly:
      "temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m",
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    forecast_days: "1",
    timezone: "auto",
  });

  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

export async function getWeather(
  latitude: number,
  longitude: number,
  forceRefresh = false,
): Promise<Weather | null> {
  const key = locationKey(latitude, longitude);
  const now = Date.now();
  const cached = cache.get(key);

  if (!forceRefresh && cached && now - cached.at < CACHE_MS) {
    return cached.value;
  }

  const lastFailureAt = failures.get(key) ?? 0;

  if (!forceRefresh && now - lastFailureAt < FAILURE_COOLDOWN_MS) {
    return cached?.value ?? null;
  }

  try {
    const response = await fetch(buildUrl(latitude, longitude), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const weather = parseOpenMeteo(await response.json());

    if (!weather) {
      throw new Error("Unexpected Open-Meteo response");
    }

    cache.set(key, { at: Date.now(), value: weather });
    failures.delete(key);

    return weather;
  } catch (err) {
    failures.set(key, Date.now());
    console.error("Weather unavailable:", (err as Error).message);
    return cached?.value ?? null;
  }
}
