export interface HourlyWeather {
  time: string;
  tempC: number;
  code: number;
  rainChance: number | null;
  windKmh: number | null;
  humidity: number | null;
}

export interface Weather {
  tempC: number;
  code: number;
  maxC: number | null;
  minC: number | null;
  rainChance: number | null;
  windKmh: number | null;
  humidity: number | null;
  hourly: HourlyWeather[];
}

const CODES: Array<{ codes: number[]; icon: string; text: string }> = [
  { codes: [0], icon: "☀️", text: "cerah" },
  { codes: [1], icon: "🌤️", text: "cerah berawan" },
  { codes: [2], icon: "⛅", text: "berawan sebagian" },
  { codes: [3], icon: "☁️", text: "berawan" },
  { codes: [45, 48], icon: "🌫️", text: "berkabut" },
  { codes: [51, 53, 55, 56, 57], icon: "🌦️", text: "gerimis" },
  { codes: [61], icon: "🌧️", text: "hujan ringan" },
  { codes: [63, 66, 67], icon: "🌧️", text: "hujan sedang" },
  { codes: [65], icon: "🌧️", text: "hujan lebat" },
  { codes: [80], icon: "🌦️", text: "hujan lokal" },
  { codes: [81], icon: "🌧️", text: "hujan lokal deras" },
  { codes: [82], icon: "⛈️", text: "hujan lokal sangat deras" },
  { codes: [95], icon: "⛈️", text: "badai petir" },
  { codes: [96, 99], icon: "⛈️", text: "badai petir dan es" },
];

export function describeWeather(code: number): { icon: string; text: string } {
  return (
    CODES.find((entry) => entry.codes.includes(code)) ?? {
      icon: "🌡️",
      text: "cuaca tidak diketahui",
    }
  );
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function at(value: unknown, index: number): number | null {
  return Array.isArray(value) ? num(value[index]) : null;
}

function formatHour(value: unknown): string {
  if (typeof value !== "string") return "--:--";
  return value.slice(11, 16);
}

export function parseOpenMeteo(json: unknown): Weather | null {
  const data = json as {
    current?: Record<string, unknown>;
    daily?: Record<string, unknown>;
    hourly?: Record<string, unknown>;
  } | null;

  const temp = num(data?.current?.temperature_2m);
  const code = num(data?.current?.weather_code);
  if (temp === null || code === null) return null;

  const times = data?.hourly?.time;
  const currentTime = String(data?.current?.time ?? "");
  const currentHour = Number(currentTime.slice(11, 13));

  const hourly: HourlyWeather[] = [];

  if (Array.isArray(times)) {
    for (let i = 0; i < times.length; i++) {
      const time = times[i];
      if (typeof time !== "string") continue;

      const hour = Number(time.slice(11, 13));
      if (hour <= currentHour) continue;

      const tempC = at(data?.hourly?.temperature_2m, i);
      const weatherCode = at(data?.hourly?.weather_code, i);

      if (tempC === null || weatherCode === null) continue;

      hourly.push({
        time: formatHour(time),
        tempC,
        code: weatherCode,
        rainChance: at(data?.hourly?.precipitation_probability, i),
        windKmh: at(data?.hourly?.wind_speed_10m, i),
        humidity: at(data?.hourly?.relative_humidity_2m, i),
      });

      if (hourly.length >= 6) break;
    }
  }

  return {
    tempC: temp,
    code,
    maxC: at(data?.daily?.temperature_2m_max, 0),
    minC: at(data?.daily?.temperature_2m_min, 0),
    rainChance: at(data?.daily?.precipitation_probability_max, 0),
    windKmh: num(data?.current?.wind_speed_10m),
    humidity: num(data?.current?.relative_humidity_2m),
    hourly,
  };
}

export function formatWeatherLine(label: string, weather: Weather): string {
  const { icon, text } = describeWeather(weather.code);
  return `${icon} ${label} · ${Math.round(weather.tempC)}°C, ${text}`;
}

export function formatWeatherDetail(label: string, weather: Weather): string {
  const { icon, text } = describeWeather(weather.code);

  const lines = [
    `${icon} Cuaca · ${label}`,
    "━━━━━━━━━━━━━━━━━━",
    "",
    `🌡️ Sekarang: ${Math.round(weather.tempC)}°C, ${text}`,
  ];

  if (weather.minC !== null && weather.maxC !== null) {
    lines.push(
      `📈 Hari ini: ${Math.round(weather.minC)}°C – ${Math.round(weather.maxC)}°C`,
    );
  }

  if (weather.rainChance !== null) {
    lines.push(`🌧️ Peluang hujan: ${Math.round(weather.rainChance)}%`);
  }

  if (weather.windKmh !== null) {
    lines.push(`💨 Angin: ${Math.round(weather.windKmh)} km/j`);
  }

  if (weather.humidity !== null) {
    lines.push(`💧 Kelembapan: ${Math.round(weather.humidity)}%`);
  }

  lines.push("", "━━━━━━━━━━━━━━━━━━", "", "🕒 Prakiraan Per Jam:");

  if (weather.hourly.length === 0) {
    lines.push("Data prakiraan per jam belum tersedia.");
  } else {
    for (const hour of weather.hourly) {
      const condition = describeWeather(hour.code);

      const details = [
        hour.rainChance !== null
          ? `Hujan ${Math.round(hour.rainChance)}%`
          : null,
        hour.windKmh !== null ? `💨 ${Math.round(hour.windKmh)} km/j` : null,
        hour.humidity !== null ? `💧 ${Math.round(hour.humidity)}%` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      lines.push(
        `${hour.time} | ${condition.icon} ${Math.round(hour.tempC)}°C · ${condition.text}`,
      );

      if (details) lines.push(`       ${details}`);
    }
  }

  lines.push("", "Data bersumber dari Open-Meteo.com");
  return lines.join("\n");
}
