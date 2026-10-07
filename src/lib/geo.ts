/** IUGG mean Earth radius in km. */
export const EARTH_RADIUS_KM = 6371.0088;
export const KM_PER_MILE = 1.609344;

export interface LatLon {
  lat: number;
  lon: number;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km between two points (haversine formula). */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function kmToMiles(km: number): number {
  return km / KM_PER_MILE;
}

export function formatDistance(km: number, unit: 'km' | 'mi'): string {
  const v = unit === 'km' ? km : kmToMiles(km);
  return `${Math.round(v).toLocaleString('en-AU')} ${unit}`;
}
