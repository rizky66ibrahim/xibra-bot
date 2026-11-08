// Pure weather helpers: WMO weather codes, parsing the Open-Meteo answer, and formatting.
// No network and no Telegram here, so everything is easy to test.

export interface Weather {
  tempC: number;
  code: number;
  maxC: number | null;
  minC: number | null;
  rainChance: number | null;
}

// WMO weather interpretation codes, in Indonesian
const CODES: Array<{ codes: number[]; icon: string; text: string }> = [
  { codes: [0], icon: "☀️", text: "cerah" },
  { codes: [1], icon: "🌤️", text: "cerah berawan" },
  { codes: [2], icon: "⛅", text: "berawan sebagian" },
  { codes: [3], icon: "☁️", text: "berawan" },
  { codes: [45, 48], icon: "🌫️", text: "berkabut" },
  { codes: [51, 53, 55, 56, 57], icon: "🌦️", text: "gerimis" },
  { codes: [61], icon: "🌧️", text: "hujan ringan" },
  { codes: [63, 66, 67], icon: "🌧️", text: "hujan" },
  { codes: [65], icon: "🌧️", text: "hujan lebat" },
  { codes: [80], icon: "🌦️", text: "hujan lokal" },
  { codes: [81], icon: "🌧️", text: "hujan lokal deras" },
  { codes: [82], icon: "⛈️", text: "hujan lokal sangat deras" },
  { codes: [95], icon: "⛈️", text: "badai petir" },
  { codes: [96, 99], icon: "⛈️", text: "badai petir dan es" },
];

export function describeWeather(code: number): { icon: string; text: string } {
  const found = CODES.find((entry) => entry.codes.includes(code));
  return found ? { icon: found.icon, text: found.text } : { icon: "🌡️", text: "cuaca tidak diketahui" };
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function first(value: unknown): number | null {
  return Array.isArray(value) ? num(value[0]) : null;
}

// Reads the Open-Meteo "forecast" answer. Returns null when the current values are missing.
export function parseOpenMeteo(json: unknown): Weather | null {
  const data = json as {
    current?: { temperature_2m?: unknown; weather_code?: unknown };
    daily?: {
      temperature_2m_max?: unknown;
      temperature_2m_min?: unknown;
      precipitation_probability_max?: unknown;
    };
  } | null;

  const temp = num(data?.current?.temperature_2m);
  const code = num(data?.current?.weather_code);
  if (temp === null || code === null) return null;

  return {
    tempC: temp,
    code,
    maxC: first(data?.daily?.temperature_2m_max),
    minC: first(data?.daily?.temperature_2m_min),
    rainChance: first(data?.daily?.precipitation_probability_max),
  };
}

// One line for the home screen: "🌤️ Bekasi, Jawa Barat · 25°C, cerah berawan"
export function formatWeatherLine(label: string, weather: Weather): string {
  const { icon, text } = describeWeather(weather.code);
  return `${icon} ${label} · ${Math.round(weather.tempC)}°C, ${text}`;
}

// Fuller view for /weather
export function formatWeatherDetail(label: string, weather: Weather): string {
  const { icon, text } = describeWeather(weather.code);
  const lines = [`${icon} Cuaca ${label}`, `Sekarang ${Math.round(weather.tempC)}°C, ${text}`];

  if (weather.minC !== null && weather.maxC !== null) {
    lines.push(`Hari ini ${Math.round(weather.minC)}–${Math.round(weather.maxC)}°C`);
  }
  if (weather.rainChance !== null) {
    lines.push(`Peluang hujan ${Math.round(weather.rainChance)}%`);
  }

  lines.push("", "Data: Open-Meteo.com");
  return lines.join("\n");
}
