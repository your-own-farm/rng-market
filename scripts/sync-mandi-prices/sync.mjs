#!/usr/bin/env node
// ── sync-mandi-prices ────────────────────────────────────────────────────────
// One-shot pull from data.gov.in (Agmarknet) → Firebase Realtime Database.
// Run on a 30-min schedule (Cloud Scheduler / GitHub Actions / k8s cron / unix
// cron) so the public site reads cheap Firebase data 99 % of the time and only
// reaches out to OGD when the cron has missed a beat.
//
// Required env:
//   DATA_GOV_KEY                 — free key from https://data.gov.in/user
//   FIREBASE_DATABASE_URL        — e.g. https://your-roots-6874d-default-rtdb.firebaseio.com
//   GOOGLE_APPLICATION_CREDENTIALS — path to a service-account JSON with RTDB
//                                  write access.
//
// Optional:
//   STATE_FILTER                 — e.g. "Maharashtra" to scope the pull
//   RECORD_LIMIT                 — default 2000
//
// Cost shape: one OGD call per run regardless of traffic. With a 30-min
// cadence that's ~48 calls/day, well inside the free 5 000/day quota.

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

const RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
const API_BASE    = "https://api.data.gov.in/resource";
const API_KEY     = process.env.DATA_GOV_KEY;
const DB_URL      = process.env.FIREBASE_DATABASE_URL;
const STATE       = process.env.STATE_FILTER || null;
const LIMIT       = parseInt(process.env.RECORD_LIMIT || "2000", 10);

if (!API_KEY) { console.error("DATA_GOV_KEY missing");  process.exit(2); }
if (!DB_URL)  { console.error("FIREBASE_DATABASE_URL missing"); process.exit(2); }

// ── Commodity ↔ crop-id map (mirror of the browser client) ──────────────────
const COMMODITY_TO_CROP = {
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

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const parseDate = (s) => {
  if (!s) return null;
  if (s.includes("/")) {
    const [dd, mm, yyyy] = s.split("/").map((x) => parseInt(x, 10));
    if (!dd || !mm || !yyyy) return null;
    return new Date(yyyy, mm - 1, dd);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

async function fetchAgmarknet({ state, limit }) {
  const params = new URLSearchParams({
    "api-key": API_KEY,
    "format":  "json",
    "limit":   String(limit ?? 1000),
  });
  if (state) params.set("filters[state]", state);
  const url = `${API_BASE}/${RESOURCE_ID}?${params.toString()}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`OGD HTTP ${r.status}`);
  const j = await r.json();
  return j.records ?? [];
}

async function main() {
  console.log(`[${new Date().toISOString()}] syncing — state=${STATE ?? "ALL"} limit=${LIMIT}`);
  const rows = await fetchAgmarknet({ state: STATE, limit: LIMIT });
  console.log(`  ${rows.length} OGD rows received`);

  // Shape: /crop-prices/{state}/{district}/{crop}
  const tree = { _meta: { lastSyncAt: Date.now(), recordCount: 0, source: "data.gov.in" } };

  // Keep only the most recent record per (state, district, crop).
  const dedup = new Map();
  for (const r of rows) {
    const cropId = COMMODITY_TO_CROP[r.commodity?.trim().toLowerCase()];
    if (!cropId) continue;
    const modal = parseFloat(r.modal_price);
    if (!isFinite(modal) || modal <= 0) continue;
    const date = parseDate(r.arrival_date) ?? new Date();

    const key = `${r.state}|${r.district}|${cropId}`;
    const ex  = dedup.get(key);
    if (!ex || date > ex.date) {
      dedup.set(key, {
        date,
        record: {
          crop:      r.commodity.trim(),
          state:     r.state,
          district:  r.district,
          market:    r.market,
          price:     Math.round(modal),
          prevPrice: ex ? ex.record.price : Math.round(modal),
          unit:      "quintal",
          updatedAt: date.getTime(),
        },
      });
    }
  }

  for (const { record } of dedup.values()) {
    const s = slug(record.state);
    const d = slug(record.district);
    const c = slug(record.crop);
    tree[s] = tree[s] || {};
    tree[s][d] = tree[s][d] || {};
    tree[s][d][c] = record;
    tree._meta.recordCount++;
  }

  initializeApp({ credential: applicationDefault(), databaseURL: DB_URL });
  await getDatabase().ref("crop-prices").set(tree);
  console.log(`  wrote ${tree._meta.recordCount} records to RTDB ✓`);
}

main().catch((err) => {
  console.error("sync failed:", err);
  process.exit(1);
});
