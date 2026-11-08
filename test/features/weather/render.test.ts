import { test } from "node:test";
import assert from "node:assert/strict";
import {
  describeWeather,
  formatWeatherDetail,
  formatWeatherLine,
  parseOpenMeteo,
} from "../../../src/features/weather/render.js";

// Shape of a real Open-Meteo answer for current + daily values
const SAMPLE = {
  current: { time: "2026-11-05T06:00", interval: 900, temperature_2m: 25.4, weather_code: 80 },
  daily: {
    time: ["2026-11-05"],
    temperature_2m_max: [31.2],
    temperature_2m_min: [24.1],
    precipitation_probability_max: [70],
  },
};

test("weather codes map to Indonesian text and an icon", () => {
  assert.deepEqual(describeWeather(0), { icon: "☀️", text: "cerah" });
  assert.equal(describeWeather(3).text, "berawan");
  assert.equal(describeWeather(80).text, "hujan lokal");
  assert.equal(describeWeather(95).text, "badai petir");
});

test("an unknown code does not break the line", () => {
  assert.equal(describeWeather(1234).text, "cuaca tidak diketahui");
});

test("parseOpenMeteo reads the current and daily values", () => {
  assert.deepEqual(parseOpenMeteo(SAMPLE), {
    tempC: 25.4,
    code: 80,
    maxC: 31.2,
    minC: 24.1,
    rainChance: 70,
  });
});

test("parseOpenMeteo still works without the daily block", () => {
  const weather = parseOpenMeteo({ current: { temperature_2m: 28, weather_code: 3 } });
  assert.equal(weather?.tempC, 28);
  assert.equal(weather?.maxC, null);
  assert.equal(weather?.rainChance, null);
});

test("parseOpenMeteo returns null for answers it cannot use", () => {
  assert.equal(parseOpenMeteo(null), null);
  assert.equal(parseOpenMeteo({}), null);
  assert.equal(parseOpenMeteo({ current: { temperature_2m: "hot", weather_code: 1 } }), null);
});

test("the home line is one short sentence with the rounded temperature", () => {
  const weather = parseOpenMeteo(SAMPLE);
  if (!weather) throw new Error("the sample should parse");
  assert.equal(formatWeatherLine("Bekasi, Jawa Barat", weather), "🌦️ Bekasi, Jawa Barat · 25°C, hujan lokal");
});

test("the detail view adds the range, the rain chance, and the data source", () => {
  const weather = parseOpenMeteo(SAMPLE);
  if (!weather) throw new Error("the sample should parse");
  const text = formatWeatherDetail("Bekasi, Jawa Barat", weather);
  assert.match(text, /Hari ini 24–31°C/);
  assert.match(text, /Peluang hujan 70%/);
  assert.match(text, /Open-Meteo/);
});
