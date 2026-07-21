import { describe, expect, it, vi } from "vitest";

import { demoCities, findDemoCity } from "../src/lib/demo/demo-cities";
import {
  fetchLiveWeatherTags,
  mapOpenMeteoToWeatherTags,
} from "../src/lib/demo/weather-lookup";
import {
  createInitialKitchenSoundDemoState,
  kitchenSoundDemoReducer,
} from "../src/lib/demo/demo-state";

describe("deterministic Open-Meteo tag mapping", () => {
  it("maps codes and thresholds to the reviewed tag vocabulary", () => {
    expect(mapOpenMeteoToWeatherTags({ weatherCode: 0, temperatureC: 20, windSpeedKmh: 5 })).toEqual(["sunny"]);
    expect(mapOpenMeteoToWeatherTags({ weatherCode: 3, temperatureC: 20, windSpeedKmh: 5 })).toEqual(["cloudy"]);
    expect(mapOpenMeteoToWeatherTags({ weatherCode: 61, temperatureC: 12, windSpeedKmh: 5 })).toEqual(["rainy"]);
    expect(mapOpenMeteoToWeatherTags({ weatherCode: 71, temperatureC: -3, windSpeedKmh: 30 })).toEqual(["snowy", "cold", "windy"]);
    expect(mapOpenMeteoToWeatherTags({ weatherCode: 0, temperatureC: 33, windSpeedKmh: 5 })).toEqual(["sunny", "hot"]);
    expect(mapOpenMeteoToWeatherTags({ weatherCode: 96, temperatureC: 18, windSpeedKmh: 40 })).toEqual(["rainy", "windy"]);
  });

  it("never returns an empty or oversized tag set", () => {
    // An unmapped code with mild conditions falls back to "unknown".
    expect(mapOpenMeteoToWeatherTags({ weatherCode: 40, temperatureC: 15, windSpeedKmh: 5 })).toEqual(["unknown"]);
    const maximal = mapOpenMeteoToWeatherTags({ weatherCode: 61, temperatureC: -10, windSpeedKmh: 50 });
    expect(maximal.length).toBeLessThanOrEqual(4);
    expect(maximal.length).toBeGreaterThan(0);
  });
});

describe("live weather fetch boundary", () => {
  it("requests only the curated city's fixed public coordinates", async () => {
    const city = findDemoCity("Seattle, Washington")!;
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      current: { temperature_2m: 8, weather_code: 61, wind_speed_10m: 12 },
    }), { status: 200 })) as unknown as typeof fetch;

    const suggestion = await fetchLiveWeatherTags(city, fetchImpl);
    expect(suggestion.tags).toEqual(["rainy"]);
    expect(suggestion.conditionSummary).toContain("8°C");
    const url = String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]);
    expect(url).toContain("api.open-meteo.com");
    expect(url).toContain(`latitude=${city.latitude}`);
    expect(url).not.toMatch(/name|label|Seattle/);
  });

  it("throws a content-free error on failure or malformed payloads", async () => {
    const city = demoCities[0];
    const failing = vi.fn(async () => new Response("x", { status: 500 })) as unknown as typeof fetch;
    await expect(fetchLiveWeatherTags(city, failing)).rejects.toThrow("weather_lookup_failed");
    const malformed = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    await expect(fetchLiveWeatherTags(city, malformed)).rejects.toThrow("weather_lookup_malformed");
  });
});

describe("weather suggestion state", () => {
  it("replaces tags, marks the lookup source, and requires reapproval", () => {
    const initial = createInitialKitchenSoundDemoState();
    const suggested = kitchenSoundDemoReducer(initial, {
      type: "SET_WEATHER_TAGS",
      tags: ["snowy", "cold"],
      source: "weather_lookup",
    });
    expect(suggested.selectedWeatherTags).toEqual(["snowy", "cold"]);
    expect(suggested.weatherSource).toBe("weather_lookup");
    expect(suggested.parentApprovedWeather).toBe(false);

    // A manual edit afterwards records the parent as the source.
    const edited = kitchenSoundDemoReducer(suggested, { type: "TOGGLE_WEATHER_TAG", tag: "windy" });
    expect(edited.weatherSource).toBe("parent_selected");

    // Out-of-bounds suggestions are ignored.
    expect(
      kitchenSoundDemoReducer(initial, { type: "SET_WEATHER_TAGS", tags: [], source: "weather_lookup" }),
    ).toBe(initial);
  });
});
