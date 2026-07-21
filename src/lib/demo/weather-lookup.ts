import type { z } from "zod";

import type { WeatherTagSchema } from "../schemas";
import type { DemoCity } from "./demo-cities";

export type WeatherTag = z.infer<typeof WeatherTagSchema>;

/**
 * Deterministic mapping from Open-Meteo current conditions to the reviewed
 * weather-tag vocabulary. Intentionally not a model call: the tags are a small
 * closed set, a lookup table is exact, free, and instant, and the parent still
 * approves the final selection before anything enters the activity context.
 *
 * WMO weather codes: 0 clear · 1 mainly clear · 2 partly cloudy · 3 overcast ·
 * 45/48 fog · 51-67 drizzle/rain · 71-77 snow · 80-82 showers ·
 * 85-86 snow showers · 95-99 thunderstorm.
 */
export function mapOpenMeteoToWeatherTags(current: {
  weatherCode: number;
  temperatureC: number;
  windSpeedKmh: number;
}): WeatherTag[] {
  const tags: WeatherTag[] = [];
  const { weatherCode, temperatureC, windSpeedKmh } = current;

  if (weatherCode === 0 || weatherCode === 1) tags.push("sunny");
  else if (weatherCode === 2 || weatherCode === 3 || weatherCode === 45 || weatherCode === 48) tags.push("cloudy");
  else if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82) || weatherCode >= 95) tags.push("rainy");
  else if ((weatherCode >= 71 && weatherCode <= 77) || weatherCode === 85 || weatherCode === 86) tags.push("snowy");

  if (temperatureC >= 28) tags.push("hot");
  if (temperatureC <= 5) tags.push("cold");
  if (windSpeedKmh >= 25) tags.push("windy");

  const bounded = tags.slice(0, 4);
  return bounded.length > 0 ? bounded : ["unknown"];
}

export type LiveWeatherSuggestion = {
  tags: WeatherTag[];
  /** Parent-facing description, e.g. "3°C, code 71, wind 12 km/h". */
  conditionSummary: string;
};

/**
 * Fetches current conditions for a curated public demo city from Open-Meteo
 * (no key, no account) and maps them locally to suggested tags. Only the
 * city's fixed public coordinates are sent; nothing else leaves the browser,
 * and the parent must still approve the suggested tags.
 */
export async function fetchLiveWeatherTags(
  city: DemoCity,
  fetchImpl: typeof fetch = fetch,
): Promise<LiveWeatherSuggestion> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${city.latitude}&longitude=${city.longitude}` +
    "&current=temperature_2m,weather_code,wind_speed_10m";
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error("weather_lookup_failed");
  }
  const body = (await response.json()) as {
    current?: { temperature_2m?: number; weather_code?: number; wind_speed_10m?: number };
  };
  const current = body.current;
  if (
    !current ||
    typeof current.temperature_2m !== "number" ||
    typeof current.weather_code !== "number" ||
    typeof current.wind_speed_10m !== "number"
  ) {
    throw new Error("weather_lookup_malformed");
  }
  const tags = mapOpenMeteoToWeatherTags({
    weatherCode: current.weather_code,
    temperatureC: current.temperature_2m,
    windSpeedKmh: current.wind_speed_10m,
  });
  return {
    tags,
    conditionSummary: `${Math.round(current.temperature_2m)}°C, wind ${Math.round(current.wind_speed_10m)} km/h`,
  };
}
