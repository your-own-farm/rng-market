// ── SoilGrids (ISRIC) lookup ─────────────────────────────────────────────────
// Free, no API key. Open data under CC-BY-4.0 from ISRIC — World Soil Info.
// https://rest.isric.org/soilgrids/v2.0/docs
//
// Endpoint returns soil properties (clay/sand/silt %, organic carbon, pH) at
// multiple depths. We average the top 0–30 cm and classify into the SoilType
// taxonomy the recommender already understands.

import React from "react";
import { SoilType } from "./crops";

export interface SoilData {
  /** Topsoil composition % */
  sand: number;
  silt: number;
  clay: number;
  /** g/kg (multiply by 0.1 for %). */
  organicCarbon: number | null;
  /** pH × 10 in SoilGrids units → we present as actual pH. */
  ph: number | null;
  /** Classified soil type usable by the recommender. */
  classified: SoilType;
  source: "soilgrids" | "fallback";
}

export interface SoilState {
  data: SoilData | null;
  loading: boolean;
  error: string | null;
}

const ENDPOINT = "https://rest.isric.org/soilgrids/v2.0/properties/query";

function classify(sand: number, silt: number, clay: number): SoilType {
  // USDA-ish triangle, simplified.
  if (clay >= 40) return "clay";
  if (sand >= 70) return "sandy";
  if (clay >= 25 && sand >= 30) return "loamy";
  if (silt >= 50) return "loamy";
  return "loamy";
}

async function fetchSoil(lat: number, lng: number): Promise<SoilData> {
  const params = new URLSearchParams({
    lon: lng.toFixed(4),
    lat: lat.toFixed(4),
    property: "sand",
    value: "mean",
  });
  // SoilGrids accepts multiple `property` query params — append them manually.
  const url =
    `${ENDPOINT}?${params.toString()}` +
    `&property=silt&value=mean` +
    `&property=clay&value=mean` +
    `&property=soc&value=mean` +
    `&property=phh2o&value=mean` +
    `&depth=0-30cm`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j: any = await r.json();

  const props = j.properties?.layers ?? [];
  const pick = (name: string): number | null => {
    const layer = props.find((p: any) => p.name === name);
    const depths = layer?.depths ?? [];
    const v = depths[0]?.values?.mean;
    // SoilGrids stores values multiplied by `d_factor`. Apply it.
    const factor = layer?.unit_measure?.d_factor ?? 1;
    return v != null ? v / factor : null;
  };

  const sand = pick("sand") ?? 33;
  const silt = pick("silt") ?? 33;
  const clay = pick("clay") ?? 34;
  const oc   = pick("soc");
  const ph   = pick("phh2o");

  return {
    sand, silt, clay,
    organicCarbon: oc,
    ph,
    classified: classify(sand, silt, clay),
    source: "soilgrids",
  };
}

const cache = new Map<string, { data: SoilData; at: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — soil doesn't change

export function useSoil(lat: number | null, lng: number | null, fallbackSoil: SoilType = "loamy"): SoilState {
  const [state, setState] = React.useState<SoilState>({ data: null, loading: false, error: null });

  React.useEffect(() => {
    if (lat == null || lng == null) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      setState({ data: hit.data, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    fetchSoil(lat, lng)
      .then((data) => {
        if (cancelled) return;
        cache.set(key, { data, at: Date.now() });
        setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        // Synthesize a record from the static district soil hint so the UI
        // still shows something rather than a blank.
        const data: SoilData = {
          sand: 33, silt: 33, clay: 34,
          organicCarbon: null, ph: null,
          classified: fallbackSoil,
          source: "fallback",
        };
        cache.set(key, { data, at: Date.now() });
        setState({ data, loading: false, error: String(err.message ?? err) });
      });

    return () => { cancelled = true; };
  }, [lat, lng, fallbackSoil]);

  return state;
}
