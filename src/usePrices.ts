// ── usePrices ────────────────────────────────────────────────────────────────
// Smart price source chain — designed to minimise expensive OGD calls.
//
//   ┌─────────────────────┐
//   │  scripts/sync-prices │  ← Node cron, every 30 min
//   │  (data.gov.in →     │
//   │   Firebase RTDB)    │
//   └─────────┬───────────┘
//             │ writes /crop-prices + /crop-prices/_meta/lastSyncAt
//             ▼
//   ┌─────────────────────┐         ┌──────────────────────────┐
//   │ Firebase RTDB feed  │ ◀────── │  Browser (this hook)     │
//   │ (real-time push)    │         │                          │
//   └─────────────────────┘         │ 1. session/memory cache  │
//                                   │ 2. Firebase RTDB         │
//   ┌─────────────────────┐         │ 3. direct data.gov.in    │
//   │ data.gov.in OGD     │ ◀────── │ 4. bundled DEMO_PRICES   │
//   │ Agmarknet           │         └──────────────────────────┘
//   └─────────────────────┘
//
// Selection rule the browser applies:
//
//   • If sessionStorage holds a snapshot < 30 min old → use it (0 network).
//   • Else subscribe to Firebase and read /crop-prices/_meta/lastSyncAt:
//       – within 35 min → use Firebase (1 cheap socket frame, no OGD).
//       – stale or absent → fall back to a direct OGD call.
//   • OGD itself fails (no key / rate-limited / offline) → use the most
//     recent Firebase data (even if stale), then demo.
//
// "Refresh" button forces an OGD call regardless of caches.

import React from "react";
import { ref, onValue, off } from "firebase/database";
import { db } from "./firebase";
import { CropPrice, CropPriceVM, toVM, DEMO_PRICES } from "./types";
import { cachedSnapshot, fetchAgmarknetSnapshot, HAS_AGMARKNET_KEY } from "./useAgmarknet";

export type PriceSource = "cache" | "firebase" | "data.gov.in" | "demo";

export interface PricesResult {
  prices:     CropPriceVM[];
  live:       boolean;
  source:     PriceSource;
  /** Epoch ms of the most recent verified update across any source. */
  lastSyncAt: number | null;
  /** True while a network refresh is in-flight (Firebase subscribe or OGD fetch). */
  refreshing: boolean;
  /** Force a direct OGD fetch — bypasses all caches. */
  refresh:    () => void;
}

const FIREBASE_FRESH_MS = 35 * 60 * 1000;   // 30-min sync + 5-min buffer

export function usePrices(): PricesResult {
  const [prices, setPrices]         = React.useState<CropPriceVM[]>([]);
  const [source, setSource]         = React.useState<PriceSource>("demo");
  const [lastSyncAt, setLastSyncAt] = React.useState<number | null>(null);
  const [refreshing, setRefreshing] = React.useState(true);
  // A monotonically-increasing token used to force-re-run the resolve effect.
  const [refreshToken, setRefreshToken] = React.useState(0);

  // ── Resolve chain ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    let cancelled = false;
    setRefreshing(true);

    // Step 1 — session/memory cache (zero network).
    if (refreshToken === 0) {
      const cached = cachedSnapshot(null);
      if (cached && cached.rows.length > 0) {
        setPrices(cached.rows);
        setSource("cache");
        setLastSyncAt(cached.fetchedAt);
        setRefreshing(false);
        // Cache satisfies the page, but we still attach a Firebase listener
        // so that when the 30-min sync writes new data the UI updates live.
        attachFirebase(false);
        return () => { cancelled = true; detach(); };
      }
    }

    // Step 2 — Firebase RTDB (primary "fresh" source via the cron sync).
    let detach: () => void = () => {};
    function attachFirebase(allowOGDFallback: boolean) {
      const pricesRef = ref(db, "crop-prices");
      const handler = onValue(
        pricesRef,
        (snapshot) => {
          if (cancelled) return;
          const raw = snapshot.val();
          if (raw) {
            const meta = raw._meta as { lastSyncAt?: number } | undefined;
            const flat: CropPrice[] = [];
            for (const stateKey of Object.keys(raw)) {
              if (stateKey === "_meta") continue;
              for (const districtKey of Object.keys(raw[stateKey])) {
                for (const cropKey of Object.keys(raw[stateKey][districtKey])) {
                  flat.push(raw[stateKey][districtKey][cropKey] as CropPrice);
                }
              }
            }
            const syncedAt = meta?.lastSyncAt
              ?? Math.max(...flat.map((p) => p.updatedAt), 0)
              ?? Date.now();
            const isFresh = Date.now() - syncedAt < FIREBASE_FRESH_MS;

            if (flat.length > 0 && (isFresh || !allowOGDFallback)) {
              setPrices(flat.map(toVM));
              setSource("firebase");
              setLastSyncAt(syncedAt);
              setRefreshing(false);
              return;
            }
            // Stale data is still better than nothing — keep it around and try OGD.
            if (flat.length > 0) {
              setPrices(flat.map(toVM));
              setSource("firebase");
              setLastSyncAt(syncedAt);
            }
          }
          if (allowOGDFallback) kickOGD();
          else                  finishWithDemoIfStillEmpty();
        },
        () => {
          if (cancelled) return;
          if (allowOGDFallback) kickOGD();
          else                  finishWithDemoIfStillEmpty();
        }
      );
      detach = () => off(pricesRef, "value", handler as any);
    }

    function kickOGD() {
      if (!HAS_AGMARKNET_KEY) { finishWithDemoIfStillEmpty(); return; }
      fetchAgmarknetSnapshot(null, { force: refreshToken > 0 })
        .then((rows) => {
          if (cancelled) return;
          if (rows.length > 0) {
            setPrices(rows);
            setSource("data.gov.in");
            setLastSyncAt(Date.now());
          } else {
            finishWithDemoIfStillEmpty();
          }
          setRefreshing(false);
        })
        .catch(() => { if (!cancelled) finishWithDemoIfStillEmpty(); });
    }

    function finishWithDemoIfStillEmpty() {
      if (cancelled) return;
      setRefreshing(false);
      // Only drop to demo when we have absolutely nothing else.
      setPrices((prev) => (prev.length === 0 ? DEMO_PRICES.map(toVM) : prev));
      setSource((prev) => (prev === "demo" || prev === "cache" ? "demo" : prev));
    }

    // Initial path: try Firebase first; if it's empty/stale, escalate to OGD.
    attachFirebase(true);

    return () => { cancelled = true; detach(); };
  }, [refreshToken]);

  // ── Demo-mode jitter (only when nothing real is connected) ────────────────
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

  const refresh = React.useCallback(() => setRefreshToken((n) => n + 1), []);

  return { prices, live: source !== "demo", source, lastSyncAt, refreshing, refresh };
}
