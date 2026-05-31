// ── Indian state / district reference ────────────────────────────────────────
// Static lookup so the picker works offline. Each district carries a centroid
// lat/lng for weather + soil lookups. Coverage is the major agricultural
// districts across 16 states — enough to drive recommendations for the bulk of
// farming households.

import { SoilType } from "./crops";

export interface District {
  name: string;
  lat: number;
  lng: number;
  /** Dominant soil class (rough — refined by SoilGrids if reachable). */
  soil: SoilType;
}

export interface StateGeo {
  name: string;
  /** Region used by the rest of the platform. */
  region: "North" | "South" | "East" | "West" | "Central";
  districts: District[];
}

export const STATES: StateGeo[] = [
  {
    name: "Maharashtra", region: "West",
    districts: [
      { name: "Nashik",     lat: 20.0059, lng: 73.7910, soil: "black" },
      { name: "Pune",       lat: 18.5204, lng: 73.8567, soil: "black" },
      { name: "Solapur",    lat: 17.6599, lng: 75.9064, soil: "black" },
      { name: "Jalgaon",    lat: 21.0077, lng: 75.5626, soil: "black" },
      { name: "Ahmednagar", lat: 19.0948, lng: 74.7480, soil: "black" },
    ],
  },
  {
    name: "Punjab", region: "North",
    districts: [
      { name: "Amritsar",   lat: 31.6340, lng: 74.8723, soil: "alluvial" },
      { name: "Ludhiana",   lat: 30.9010, lng: 75.8573, soil: "alluvial" },
      { name: "Bathinda",   lat: 30.2110, lng: 74.9455, soil: "alluvial" },
      { name: "Patiala",    lat: 30.3398, lng: 76.3869, soil: "alluvial" },
    ],
  },
  {
    name: "Haryana", region: "North",
    districts: [
      { name: "Karnal",     lat: 29.6857, lng: 76.9905, soil: "alluvial" },
      { name: "Hisar",      lat: 29.1492, lng: 75.7217, soil: "alluvial" },
      { name: "Sirsa",      lat: 29.5333, lng: 75.0167, soil: "alluvial" },
    ],
  },
  {
    name: "Uttar Pradesh", region: "Central",
    districts: [
      { name: "Agra",       lat: 27.1767, lng: 78.0081, soil: "alluvial" },
      { name: "Meerut",     lat: 28.9845, lng: 77.7064, soil: "alluvial" },
      { name: "Bareilly",   lat: 28.3670, lng: 79.4304, soil: "alluvial" },
      { name: "Lucknow",    lat: 26.8467, lng: 80.9462, soil: "alluvial" },
      { name: "Varanasi",   lat: 25.3176, lng: 82.9739, soil: "alluvial" },
    ],
  },
  {
    name: "Madhya Pradesh", region: "Central",
    districts: [
      { name: "Indore",     lat: 22.7196, lng: 75.8577, soil: "black" },
      { name: "Bhopal",     lat: 23.2599, lng: 77.4126, soil: "black" },
      { name: "Ujjain",     lat: 23.1793, lng: 75.7849, soil: "black" },
      { name: "Sagar",      lat: 23.8388, lng: 78.7378, soil: "black" },
    ],
  },
  {
    name: "Rajasthan", region: "North",
    districts: [
      { name: "Jaipur",     lat: 26.9124, lng: 75.7873, soil: "sandy" },
      { name: "Jodhpur",    lat: 26.2389, lng: 73.0243, soil: "sandy" },
      { name: "Kota",       lat: 25.2138, lng: 75.8648, soil: "black" },
      { name: "Bikaner",    lat: 28.0229, lng: 73.3119, soil: "sandy" },
    ],
  },
  {
    name: "Gujarat", region: "West",
    districts: [
      { name: "Ahmedabad",  lat: 23.0225, lng: 72.5714, soil: "black" },
      { name: "Junagadh",   lat: 21.5222, lng: 70.4579, soil: "black" },
      { name: "Rajkot",     lat: 22.3039, lng: 70.8022, soil: "black" },
      { name: "Surat",      lat: 21.1702, lng: 72.8311, soil: "black" },
    ],
  },
  {
    name: "Karnataka", region: "South",
    districts: [
      { name: "Davangere",  lat: 14.4644, lng: 75.9218, soil: "red" },
      { name: "Belgaum",    lat: 15.8497, lng: 74.4977, soil: "black" },
      { name: "Mysuru",     lat: 12.2958, lng: 76.6394, soil: "red" },
      { name: "Hubli",      lat: 15.3647, lng: 75.1240, soil: "black" },
    ],
  },
  {
    name: "Tamil Nadu", region: "South",
    districts: [
      { name: "Trichy",     lat: 10.7905, lng: 78.7047, soil: "alluvial" },
      { name: "Coimbatore", lat: 11.0168, lng: 76.9558, soil: "red" },
      { name: "Madurai",    lat: 9.9252,  lng: 78.1198, soil: "red" },
      { name: "Erode",      lat: 11.3410, lng: 77.7172, soil: "red" },
    ],
  },
  {
    name: "Andhra Pradesh", region: "South",
    districts: [
      { name: "Guntur",     lat: 16.3067, lng: 80.4365, soil: "alluvial" },
      { name: "Kurnool",    lat: 15.8281, lng: 78.0373, soil: "red" },
      { name: "Anantapur",  lat: 14.6819, lng: 77.6006, soil: "red" },
      { name: "Krishna",    lat: 16.1750, lng: 81.1389, soil: "alluvial" },
    ],
  },
  {
    name: "Telangana", region: "South",
    districts: [
      { name: "Warangal",   lat: 17.9784, lng: 79.5941, soil: "red" },
      { name: "Karimnagar", lat: 18.4386, lng: 79.1288, soil: "red" },
      { name: "Nizamabad",  lat: 18.6725, lng: 78.0941, soil: "red" },
    ],
  },
  {
    name: "West Bengal", region: "East",
    districts: [
      { name: "Hooghly",    lat: 22.9081, lng: 88.3960, soil: "alluvial" },
      { name: "Bardhaman",  lat: 23.2324, lng: 87.8615, soil: "alluvial" },
      { name: "Murshidabad", lat: 24.1840, lng: 88.2735, soil: "alluvial" },
    ],
  },
  {
    name: "Bihar", region: "East",
    districts: [
      { name: "Patna",      lat: 25.5941, lng: 85.1376, soil: "alluvial" },
      { name: "Muzaffarpur", lat: 26.1209, lng: 85.3647, soil: "alluvial" },
      { name: "Bhagalpur",  lat: 25.2425, lng: 86.9842, soil: "alluvial" },
    ],
  },
  {
    name: "Odisha", region: "East",
    districts: [
      { name: "Cuttack",    lat: 20.4625, lng: 85.8830, soil: "alluvial" },
      { name: "Sambalpur",  lat: 21.4669, lng: 83.9812, soil: "red" },
    ],
  },
  {
    name: "Kerala", region: "South",
    districts: [
      { name: "Palakkad",   lat: 10.7867, lng: 76.6548, soil: "laterite" },
      { name: "Wayanad",    lat: 11.6854, lng: 76.1320, soil: "laterite" },
    ],
  },
  {
    name: "Chhattisgarh", region: "Central",
    districts: [
      { name: "Raipur",     lat: 21.2514, lng: 81.6296, soil: "red" },
      { name: "Bilaspur",   lat: 22.0797, lng: 82.1409, soil: "red" },
    ],
  },
];

export function findState(name: string): StateGeo | undefined {
  return STATES.find((s) => s.name === name);
}

export function findDistrict(stateName: string, districtName: string): District | undefined {
  return findState(stateName)?.districts.find((d) => d.name === districtName);
}

/** Approximate distance in km between two lat/lng pairs (haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Nearest district to a given lat/lng across all states. */
export function nearestDistrict(lat: number, lng: number): { state: StateGeo; district: District; km: number } | null {
  let best: { state: StateGeo; district: District; km: number } | null = null;
  for (const s of STATES) {
    for (const d of s.districts) {
      const km = distanceKm({ lat, lng }, d);
      if (!best || km < best.km) best = { state: s, district: d, km };
    }
  }
  return best;
}
