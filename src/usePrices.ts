// ── usePrices ────────────────────────────────────────────────────────────────
// Price source chain (best → worst):
//   1. Firebase Realtime DB at /crop-prices — fed by the Python
//      market-price-agent which proxies data.gov.in. Pre-aggregated, low
//      latency, no API-key footprint for the browser.
//   2. data.gov.in (Agmarknet) directly from the browser — used when the
//      Firebase node is empty / unreachable AND a VITE_DATA_GOV_KEY is set.
//   3. Bundled DEMO_PRICES with a jitter loop so the UI doesn't go blank.

import React from "react";
import { ref, onValue, off } from "firebase/database";
import { db } from "./firebase";
import { CropPrice, CropPriceVM, toVM, DEMO_PRICES } from "./types";
import { fetchAgmarknetSnapshot, HAS_AGMARKNET_KEY } from "./useAgmarknet";

export type PriceSource = "firebase" | "data.gov.in" | "demo";

export interface PricesResult {
  prices: CropPriceVM[];
  live:   boolean;
  source: PriceSource;
}

export function usePrices(): PricesResult {
  const [prices, setPrices] = React.useState<CropPriceVM[]>([]);
  const [source, setSource] = React.useState<PriceSource>("demo");

  // ── 1. Subscribe to Firebase ──────────────────────────────────────────────
  React.useEffect(() => {
    const pricesRef = ref(db, "crop-prices");

    const unsubscribe = onValue(
      pricesRef,
      (snapshot) => {
        const raw = snapshot.val();
        if (raw) {
          const flat: CropPrice[] = [];
          for (const stateKey of Object.keys(raw)) {
            for (const districtKey of Object.keys(raw[stateKey])) {
              for (const cropKey of Object.keys(raw[stateKey][districtKey])) {
                flat.push(raw[stateKey][districtKey][cropKey] as CropPrice);
              }
            }
          }
          setPrices(flat.map(toVM));
          setSource("firebase");
          return;
        }
        // RTDB node empty — try data.gov.in next.
        kickAgmarknet(setPrices, setSource);
      },
      () => {
        // Permission denied / network error — try data.gov.in.
        kickAgmarknet(setPrices, setSource);
      }
    );

    return () => off(pricesRef, "value", unsubscribe as any);
  }, []);

  // ── 3. Demo-mode jitter — only when *no* live source is connected. ────────
  React.useEffect(() => {
    if (source !== "demo") return;
    const id = setInterval(() => {
      setPrices((prev) =>
        prev.map((p) => {
          if (Math.random() > 0.3) return p;
          const delta = (Math.random() - 0.48) * p.price * 0.03;
          const newPrice = Math.max(10, Math.round(p.price + delta));
          return toVM({ ...p, prevPrice: p.price, price: newPrice, updatedAt: Date.now() });
        })
      );
    }, 8000);
    return () => clearInterval(id);
  }, [source]);

  return { prices, live: source !== "demo", source };
}

// ─────────────────────────────────────────────────────────────────────────────
// data.gov.in fallback — fired when Firebase is empty.
// ─────────────────────────────────────────────────────────────────────────────
function kickAgmarknet(
  setPrices: React.Dispatch<React.SetStateAction<CropPriceVM[]>>,
  setSource: React.Dispatch<React.SetStateAction<PriceSource>>,
) {
  if (!HAS_AGMARKNET_KEY) {
    setPrices(DEMO_PRICES.map(toVM));
    setSource("demo");
    return;
  }
  fetchAgmarknetSnapshot(null)
    .then((rows) => {
      if (rows.length > 0) { setPrices(rows); setSource("data.gov.in"); }
      else                  { setPrices(DEMO_PRICES.map(toVM)); setSource("demo"); }
    })
    .catch(() => {
      setPrices(DEMO_PRICES.map(toVM));
      setSource("demo");
    });
}
