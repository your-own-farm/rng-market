// ── SoilGrids (ISRIC) lookup ─────────────────────────────────────────────────
// Free, no API key. Open data under CC-BY-4.0 from ISRIC — World Soil Info.
// https://rest.isric.org/soilgrids/v2.0/docs
//
// Endpoint returns soil properties (clay/sand/silt %, organic carbon, pH and
// total nitrogen) at multiple depths. We average the 0–30 cm topsoil layer
// and classify into the SoilType + nutrient taxonomy the recommender uses.

import React from "react";
import { SoilType, NutrientLevel } from "./crops";

export interface SoilData {
  /** Topsoil composition % */
  sand: number;
  silt: number;
  clay: number;
  /** Soil organic carbon (g/kg). Strong proxy for overall fertility. */
  organicCarbon: number | null;
  /** Total nitrogen (g/kg). */
  nitrogen: number | null;
  /** pH (actual scale, e.g. 6.5). */
  ph: number | null;
  /** Classified soil type usable by the recommender. */
  classified: SoilType;
  /** Coarse N/P/K availability — SoilGrids only ships N directly, so P/K are
   *  inferred from SOC + clay content (CEC proxies). */
  fertility: { n: NutrientLevel; p: NutrientLevel; k: NutrientLevel };
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

function nitrogenLevel(n: number | null): NutrientLevel {
  if (n == null) return "medium";
  if (n < 1.0)   return "low";
  if (n < 2.0)   return "medium";
  return "high";
}

/** SoilGrids doesn't return plant-available P / K directly, but soil organic
 *  carbon (SOC) and clay % are strong proxies: SOC drives mineralisation of
 *  P; clay's cation exchange capacity holds K. Crude but useful. */
function phosphorusLevel(soc: number | null, clay: number): NutrientLevel {
  const c = soc ?? 8;
  if (c >= 15 && clay >= 20) return "high";
  if (c >= 8)                return "medium";
  return "low";
}

function potassiumLevel(clay: number): NutrientLevel {
  if (clay >= 35) return "high";
  if (clay >= 18) return "medium";
  return "low";
}

async function fetchSoil(lat: number, lng: number): Promise<SoilData> {
  // SoilGrids supports multiple `property` query params on a single request.
  const url =
    `${ENDPOINT}?lon=${lng.toFixed(4)}&lat=${lat.toFixed(4)}` +
    `&property=sand&property=silt&property=clay&property=soc&property=phh2o&property=nitrogen` +
    `&depth=0-30cm&value=mean`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j: any = await r.json();

  const props = j.properties?.layers ?? [];
  const pick = (name: string): number | null => {
    const layer = props.find((p: any) => p.name === name);
    const depths = layer?.depths ?? [];
    const v = depths[0]?.values?.mean;
    const factor = layer?.unit_measure?.d_factor ?? 1;
    return v != null ? v / factor : null;
  };

  const sand = pick("sand") ?? 33;
  const silt = pick("silt") ?? 33;
  const clay = pick("clay") ?? 34;
  const soc  = pick("soc");
  const ph   = pick("phh2o");
  const n    = pick("nitrogen");

  return {
    sand, silt, clay,
    organicCarbon: soc,
    nitrogen: n,
    ph,
    classified: classify(sand, silt, clay),
    fertility: {
      n: nitrogenLevel(n),
      p: phosphorusLevel(soc, clay),
      k: potassiumLevel(clay),
    },
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
        // Synthesize a sensible record so the UI keeps moving rather than
        // rendering a blank.
        const data: SoilData = {
          sand: 33, silt: 33, clay: 34,
          organicCarbon: null, nitrogen: null, ph: null,
          classified: fallbackSoil,
          fertility: { n: "medium", p: "medium", k: "medium" },
          source: "fallback",
        };
        cache.set(key, { data, at: Date.now() });
        setState({ data, loading: false, error: String(err.message ?? err) });
      });

    return () => { cancelled = true; };
  }, [lat, lng, fallbackSoil]);

  return state;
}
