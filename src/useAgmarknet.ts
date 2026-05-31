// ── data.gov.in (Agmarknet) client ───────────────────────────────────────────
// Open Government Data (OGD) Platform India publishes daily APMC mandi prices
// scraped from Agmarknet. We hit two endpoints:
//
//   • "Current daily prices" — resource `9ef84268-d588-465a-a308-a864a43d0070`
//     Returns the most recent few thousand records, with arrival_date going
//     back ~30–60 days depending on commodity. Used both for "today's price"
//     and to build a recent history series for the forecast model.
//
// CORS: data.gov.in's OGD API supports cross-origin requests.
//
// API key: required (free at https://data.gov.in/user). Pass via env var
// `VITE_DATA_GOV_KEY`. With no key the calls fail gracefully and the app
// falls back to Firebase RTDB / MSP base prices.

import React from "react";
import { CropPrice, CropPriceVM, toVM } from "./types";

const RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
const API_BASE = "https://api.data.gov.in/resource";
const API_KEY = (typeof process !== "undefined" && process.env.VITE_DATA_GOV_KEY) || "";

// ── Raw row shape from Agmarknet ──────────────────────────────────────────────
interface AgmarknetRow {
  state:        string;
  district:     string;
  market:       string;
  commodity:    string;
  variety?:     string;
  arrival_date: string;   // "dd/mm/yyyy"
  min_price?:   string;   // ₹/quintal
  max_price?:   string;
  modal_price?: string;
}

// ── Commodity → internal crop id mapping ──────────────────────────────────────
// Agmarknet uses slightly different commodity names. Map both directions.
const COMMODITY_TO_CROP: Record<string, string> = {
  "tomato":                    "tomato",
  "onion":                     "onion",
  "potato":                    "potato",
  "paddy(dhan)(common)":       "rice",
  "paddy(dhan)(basmati)":      "rice",
  "rice":                      "rice",
  "wheat":                     "wheat",
  "soyabean":                  "soybean",
  "soybean":                   "soybean",
  "cotton":                    "cotton",
  "cotton (lint)":             "cotton",
  "maize":                     "maize",
  "groundnut":                 "groundnut",
  "groundnut pods (with shell)": "groundnut",
  "green chilli":              "chilli",
  "dry chillies":              "chilli",
  "chilli":                    "chilli",
  "sugarcane":                 "sugarcane",
  "banana":                    "banana",
  "turmeric":                  "turmeric",
  "green gram (moong)(whole)": "moong",
  "green gram":                "moong",
  "moong":                     "moong",
};

const CROP_TO_AGMARKNET_NAMES: Record<string, string[]> = {
  tomato:    ["Tomato"],
  onion:     ["Onion"],
  potato:    ["Potato"],
  rice:      ["Paddy(Dhan)(Common)", "Paddy(Dhan)(Basmati)", "Rice"],
  wheat:     ["Wheat"],
  soybean:   ["Soyabean"],
  cotton:    ["Cotton", "Cotton (Lint)"],
  maize:     ["Maize"],
  groundnut: ["Groundnut", "Groundnut Pods (with shell)"],
  chilli:    ["Green Chilli", "Dry Chillies"],
  sugarcane: ["Sugarcane"],
  banana:    ["Banana"],
  turmeric:  ["Turmeric"],
  moong:     ["Green Gram (Moong)(Whole)", "Green Gram"],
};

/** Map an Agmarknet commodity string to one of our crop IDs (or `null`). */
export function commodityToCropId(name: string): string | null {
  return COMMODITY_TO_CROP[name.trim().toLowerCase()] ?? null;
}

export function cropIdToCommodityNames(id: string): string[] {
  return CROP_TO_AGMARKNET_NAMES[id] ?? [];
}

// ── Date utilities ────────────────────────────────────────────────────────────
function parseDDMMYYYY(s: string): Date | null {
  // arrival_date format is "dd/mm/yyyy" or "yyyy-mm-dd" depending on dataset
  if (s.includes("/")) {
    const [dd, mm, yyyy] = s.split("/").map((x) => parseInt(x, 10));
    if (!dd || !mm || !yyyy) return null;
    return new Date(yyyy, mm - 1, dd);
  }
  if (s.includes("-")) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// ── Fetcher ───────────────────────────────────────────────────────────────────
async function fetchAgmarknet(opts: {
  state?: string;
  commodity?: string;
  limit?: number;
  offset?: number;
}): Promise<AgmarknetRow[]> {
  if (!API_KEY) throw new Error("data.gov.in API key not configured");

  const params = new URLSearchParams({
    "api-key": API_KEY,
    "format":  "json",
    "limit":   String(opts.limit  ?? 200),
    "offset":  String(opts.offset ?? 0),
  });
  if (opts.state)     params.set("filters[state]",     opts.state);
  if (opts.commodity) params.set("filters[commodity]", opts.commodity);

  const url = `${API_BASE}/${RESOURCE_ID}?${params.toString()}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Agmarknet HTTP ${r.status}`);
  const j: any = await r.json();
  return (j.records ?? []) as AgmarknetRow[];
}

// ── Row → CropPrice transform ─────────────────────────────────────────────────
function toCropPrice(row: AgmarknetRow): CropPrice | null {
  const id = commodityToCropId(row.commodity);
  if (!id) return null;
  const modal = parseFloat(row.modal_price ?? "");
  if (!isFinite(modal) || modal <= 0) return null;
  const d = parseDDMMYYYY(row.arrival_date);
  return {
    crop:      row.commodity.trim(),
    state:     row.state,
    district:  row.district,
    market:    row.market,
    price:     Math.round(modal),
    prevPrice: Math.round(modal),   // filled in by aggregator
    unit:      "quintal",
    updatedAt: d ? d.getTime() : Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Today snapshot: most recent record per (state, district, commodity)
// ─────────────────────────────────────────────────────────────────────────────
const snapshotCache = new Map<string, { rows: CropPriceVM[]; at: number }>();
const SNAPSHOT_TTL_MS = 30 * 60 * 1000; // 30 minutes — APMC publishes once daily

/** Fetch latest prices for a state. Falls back to nation-wide if state is null. */
export async function fetchAgmarknetSnapshot(state?: string | null): Promise<CropPriceVM[]> {
  if (!API_KEY) return [];
  const key = `snap:${state ?? "ALL"}`;
  const hit = snapshotCache.get(key);
  if (hit && Date.now() - hit.at < SNAPSHOT_TTL_MS) return hit.rows;

  const rows = await fetchAgmarknet({ state: state ?? undefined, limit: 1000 });

  // De-duplicate to one row per (commodity, district) — keep most recent.
  const dedup = new Map<string, CropPrice>();
  for (const r of rows) {
    const cp = toCropPrice(r);
    if (!cp) continue;
    const k = `${cp.crop}|${cp.state}|${cp.district}`;
    const ex = dedup.get(k);
    if (!ex || cp.updatedAt > ex.updatedAt) {
      if (ex) cp.prevPrice = ex.price;
      dedup.set(k, cp);
    }
  }

  const out = Array.from(dedup.values()).map(toVM);
  snapshotCache.set(key, { rows: out, at: Date.now() });
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Historical series: per-commodity time series for the forecast model.
// We pull the last N records for a commodity (optionally state-scoped) and
// collapse to one modal price per arrival_date.
// ─────────────────────────────────────────────────────────────────────────────
export interface PricePoint { date: Date; price: number; samples: number }

const historyCache = new Map<string, { series: PricePoint[]; at: number }>();
const HISTORY_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function fetchAgmarknetHistory(cropId: string, state?: string | null, limit = 500): Promise<PricePoint[]> {
  if (!API_KEY) return [];
  const key = `hist:${cropId}:${state ?? "ALL"}`;
  const hit = historyCache.get(key);
  if (hit && Date.now() - hit.at < HISTORY_TTL_MS) return hit.series;

  const names = cropIdToCommodityNames(cropId);
  if (names.length === 0) return [];

  // Try each agmarknet name until one yields results.
  let rows: AgmarknetRow[] = [];
  for (const n of names) {
    rows = await fetchAgmarknet({ state: state ?? undefined, commodity: n, limit });
    if (rows.length > 0) break;
  }

  // Group by arrival_date, average modal_price across markets that day.
  const buckets = new Map<string, { sum: number; n: number; date: Date }>();
  for (const r of rows) {
    const d = parseDDMMYYYY(r.arrival_date);
    if (!d) continue;
    const modal = parseFloat(r.modal_price ?? "");
    if (!isFinite(modal) || modal <= 0) continue;
    const k = d.toISOString().slice(0, 10);
    const ex = buckets.get(k);
    if (ex) { ex.sum += modal; ex.n += 1; }
    else    buckets.set(k, { sum: modal, n: 1, date: d });
  }

  const series: PricePoint[] = Array.from(buckets.values())
    .map(({ sum, n, date }) => ({ date, price: Math.round(sum / n), samples: n }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  historyCache.set(key, { series, at: Date.now() });
  return series;
}

// ─────────────────────────────────────────────────────────────────────────────
// React hooks
// ─────────────────────────────────────────────────────────────────────────────
export function useAgmarknetSnapshot(state?: string | null) {
  const [rows, setRows]       = React.useState<CropPriceVM[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError]     = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    fetchAgmarknetSnapshot(state)
      .then((r) => { if (!cancelled) { setRows(r); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(String(e?.message ?? e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [state]);

  return { rows, loading, error };
}

export function useAgmarknetHistory(cropId: string | null, state?: string | null) {
  const [series, setSeries]   = React.useState<PricePoint[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError]     = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!cropId) { setSeries([]); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    fetchAgmarknetHistory(cropId, state)
      .then((s) => { if (!cancelled) { setSeries(s); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(String(e?.message ?? e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [cropId, state]);

  return { series, loading, error };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience flag the UI can read to decide whether to render the
// "data.gov.in" attribution badge.
// ─────────────────────────────────────────────────────────────────────────────
export const HAS_AGMARKNET_KEY = !!API_KEY;
