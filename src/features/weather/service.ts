// Fetches the current weather from Open-Meteo (free, no API key) and keeps it for a few minutes.
import { config } from "../../core/config.js";
import { parseOpenMeteo, type Weather } from "./render.js";

const CACHE_MS = 10 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 60 * 1000;
const TIMEOUT_MS = 5_000;

let cache: { at: number; value: Weather } | null = null;
let lastFailureAt = 0;

function buildUrl(): string {
  const params = new URLSearchParams({
    latitude: String(config.weather.latitude),
    longitude: String(config.weather.longitude),
    current: "temperature_2m,weather_code",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    forecast_days: "1",
    timezone: "Asia/Jakarta",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

// Returns null when the weather cannot be loaded. The home screen then simply leaves the line out.
export async function getWeather(): Promise<Weather | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  // Do not hammer the service right after a failure
  if (Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS) return cache?.value ?? null;

  try {
    const response = await fetch(buildUrl(), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const weather = parseOpenMeteo(await response.json());
    if (!weather) throw new Error("unexpected answer");

    cache = { at: Date.now(), value: weather };
    return weather;
  } catch (err) {
    lastFailureAt = Date.now();
    console.error("Weather unavailable:", (err as Error).message);
    // Old data is better than nothing
    return cache?.value ?? null;
  }
}
