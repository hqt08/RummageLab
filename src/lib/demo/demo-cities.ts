/**
 * Curated public demo cities. These are well-known places with fixed, public
 * coordinates — never the family's location. Choosing one only labels the demo
 * and (optionally) scopes a live weather lookup for that public city; the city
 * itself never enters the activity context or any model request.
 */
export type DemoCity = {
  label: string;
  latitude: number;
  longitude: number;
};

export const demoCities: readonly DemoCity[] = [
  { label: "Anchorage, Alaska", latitude: 61.22, longitude: -149.9 },
  { label: "Seattle, Washington", latitude: 47.61, longitude: -122.33 },
  { label: "San Francisco, California", latitude: 37.77, longitude: -122.42 },
  { label: "Denver, Colorado", latitude: 39.74, longitude: -104.99 },
  { label: "Austin, Texas", latitude: 30.27, longitude: -97.74 },
  { label: "Chicago, Illinois", latitude: 41.88, longitude: -87.63 },
  { label: "Miami, Florida", latitude: 25.76, longitude: -80.19 },
  { label: "New York, New York", latitude: 40.71, longitude: -74.01 },
  { label: "London, United Kingdom", latitude: 51.51, longitude: -0.13 },
  { label: "Tokyo, Japan", latitude: 35.68, longitude: 139.69 },
  { label: "Sydney, Australia", latitude: -33.87, longitude: 151.21 },
] as const;

export const DEFAULT_DEMO_CITY_LABEL = demoCities[0].label;

export function findDemoCity(label: string): DemoCity | undefined {
  return demoCities.find((city) => city.label === label);
}
