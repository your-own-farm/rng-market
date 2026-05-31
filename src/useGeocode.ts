// ── Reverse geocoding via OpenStreetMap Nominatim ────────────────────────────
// Free, no API key. Public usage policy requires a custom User-Agent or
// Referer header — fetch from a browser automatically sends Referer, so we
// rely on that. https://nominatim.openstreetmap.org/

import React from "react";
import { findState, nearestDistrict, StateGeo, District } from "./geo";

export interface GeocodeResult {
  lat: number;
  lng: number;
  state: StateGeo | null;
  district: District | null;
  /** Raw OSM address parts for debugging. */
  raw?: {
    displayName?: string;
    state?: string;
    county?: string;
  };
  source: "nominatim" | "fallback";
}

export interface GeoState {
  data: GeocodeResult | null;
  loading: boolean;
  error: string | null;
}

const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

/** Try OSM first; if it fails (offline / blocked), snap to the nearest known district. */
async function reverseLookup(lat: number, lng: number): Promise<GeocodeResult> {
  const url = `${ENDPOINT}?lat=${lat}&lon=${lng}&format=json&accept-language=en&zoom=8`;
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j: any = await r.json();
    const addr = j.address ?? {};
    // OSM returns state in `state`, district may live in county / state_district / district.
    const stateName: string | undefined = addr.state;
    const districtName: string | undefined =
      addr.state_district ?? addr.county ?? addr.district ?? addr.city_district;

    const state = stateName ? findState(stateName) ?? null : null;
    let district = state && districtName
      ? state.districts.find((d) => districtName.toLowerCase().includes(d.name.toLowerCase())) ?? null
      : null;

    // If OSM gave us a state but no matching district, snap to nearest within that state.
    if (state && !district) {
      let best: District | null = null;
      let bestKm = Infinity;
      for (const d of state.districts) {
        const dx = d.lat - lat, dy = d.lng - lng;
        const km = Math.sqrt(dx * dx + dy * dy) * 111;
        if (km < bestKm) { bestKm = km; best = d; }
      }
      district = best;
    }

    // If OSM failed to even give us a state, fall through to nearest-known.
    if (!state) {
      const near = nearestDistrict(lat, lng);
      return near
        ? { lat, lng, state: near.state, district: near.district, raw: { displayName: j.display_name, state: stateName, county: districtName }, source: "nominatim" }
        : { lat, lng, state: null, district: null, source: "nominatim" };
    }

    return { lat, lng, state, district, raw: { displayName: j.display_name, state: stateName, county: districtName }, source: "nominatim" };
  } catch (_) {
    // Offline / blocked → fallback to nearest district by haversine distance
    const near = nearestDistrict(lat, lng);
    return near
      ? { lat, lng, state: near.state, district: near.district, source: "fallback" }
      : { lat, lng, state: null, district: null, source: "fallback" };
  }
}

/** Imperative API — call when the user clicks "Use my location". */
export async function getCurrentLocation(): Promise<GeocodeResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Geolocation not supported by this browser.");
  }
  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 5 * 60 * 1000,
    });
  });
  return reverseLookup(pos.coords.latitude, pos.coords.longitude);
}

/** Hook flavour — pass-in lat/lng you already have. */
export function useReverseGeocode(lat: number | null, lng: number | null): GeoState {
  const [state, setState] = React.useState<GeoState>({ data: null, loading: false, error: null });

  React.useEffect(() => {
    if (lat == null || lng == null) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    reverseLookup(lat, lng)
      .then((data) => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch((err) => { if (!cancelled) setState({ data: null, loading: false, error: String(err.message ?? err) }); });
    return () => { cancelled = true; };
  }, [lat, lng]);

  return state;
}
