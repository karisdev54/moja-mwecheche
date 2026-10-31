const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

export type LngLat = [number, number];
export type Place = { name: string; address: string; coords: LngLat };
export type RouteInfo = { geometry: LngLat[]; km: number; minutes: number };
export type RouteView = { geometry: LngLat[]; from: LngLat; to: LngLat; follow?: boolean };

export function fmtMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

// Search places. Results are limited to Kenya; change country=ke to search elsewhere.
export async function searchPlaces(query: string, near?: LngLat): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({
    q,
    access_token: TOKEN,
    limit: "5",
    country: "ke",
    language: "en",
  });
  if (near) params.set("proximity", `${near[0]},${near[1]}`);

  try {
    const res = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`);
    if (!res.ok) return [];
    const json = (await res.json()) as {
      features?: {
        geometry: { coordinates: number[] };
        properties: { name?: string; full_address?: string; place_formatted?: string };
      }[];
    };
    return (json.features ?? []).map((f) => ({
      name: f.properties.name ?? "",
      address: f.properties.full_address ?? f.properties.place_formatted ?? f.properties.name ?? "",
      coords: [f.geometry.coordinates[0], f.geometry.coordinates[1]] as LngLat,
    }));
  } catch {
    return [];
  }
}

// Driving route with distance and time (includes typical traffic)
export async function getRoute(from: LngLat, to: LngLat): Promise<RouteInfo | null> {
  const params = new URLSearchParams({
    geometries: "geojson",
    overview: "full",
    access_token: TOKEN,
  });
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${from[0]},${from[1]};${to[0]},${to[1]}?${params}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      routes?: { distance: number; duration: number; geometry: { coordinates: LngLat[] } }[];
    };
    const r = json.routes?.[0];
    if (!r) return null;
    return {
      geometry: r.geometry.coordinates,
      km: Math.round(r.distance / 100) / 10,
      minutes: Math.max(1, Math.round(r.duration / 60)),
    };
  } catch {
    return null;
  }
}

export type RouteSteps = RouteInfo & {
  instruction: string;
  type?: string;
  modifier?: string;
  meters: number; // distance to the next turn
};

export async function getRouteSteps(from: LngLat, to: LngLat): Promise<RouteSteps | null> {
  const params = new URLSearchParams({
    geometries: "geojson",
    overview: "full",
    steps: "true",
    language: "en",
    access_token: TOKEN,
  });
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${from[0]},${from[1]};${to[0]},${to[1]}?${params}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      routes?: {
        distance: number;
        duration: number;
        geometry: { coordinates: LngLat[] };
        legs: {
          steps: {
            distance: number;
            maneuver: { instruction: string; type: string; modifier?: string };
          }[];
        }[];
      }[];
    };
    const r = json.routes?.[0];
    const steps = r?.legs?.[0]?.steps ?? [];
    if (!r || steps.length === 0) return null;
    // steps[0] is "head north"; steps[1] is the next turn, and steps[0].distance is how far away it is
    const next = steps[1] ?? steps[0];
    return {
      geometry: r.geometry.coordinates,
      km: Math.round(r.distance / 100) / 10,
      minutes: Math.max(1, Math.round(r.duration / 60)),
      instruction: next.maneuver.instruction,
      type: next.maneuver.type,
      modifier: next.maneuver.modifier,
      meters: steps[0].distance,
    };
  } catch {
    return null;
  }
}