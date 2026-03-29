import React from "react";
import { ref, onValue, off } from "firebase/database";
import { db } from "./firebase";
import { CropPrice, CropPriceVM, toVM, DEMO_PRICES } from "./types";

// ── usePrices ─────────────────────────────────────────────────────────────────
// Subscribes to /crop-prices in Firebase Realtime Database.
// Falls back to demo data if the DB node is empty or unreachable.

export function usePrices(): { prices: CropPriceVM[]; live: boolean } {
  const [prices, setPrices] = React.useState<CropPriceVM[]>([]);
  const [live, setLive]     = React.useState(false);

  React.useEffect(() => {
    const pricesRef = ref(db, "crop-prices");

    const unsubscribe = onValue(
      pricesRef,
      (snapshot) => {
        const raw = snapshot.val();
        if (!raw) {
          // DB empty — simulate live ticks on demo data
          setPrices(DEMO_PRICES.map(toVM));
          setLive(false);
          return;
        }

        // Flatten nested {state → district → crop → CropPrice}
        const flat: CropPrice[] = [];
        for (const stateKey of Object.keys(raw)) {
          for (const districtKey of Object.keys(raw[stateKey])) {
            for (const cropKey of Object.keys(raw[stateKey][districtKey])) {
              flat.push(raw[stateKey][districtKey][cropKey] as CropPrice);
            }
          }
        }
        setPrices(flat.map(toVM));
        setLive(true);
      },
      () => {
        // Permission denied / network error — fall back to demo
        setPrices(DEMO_PRICES.map(toVM));
        setLive(false);
      }
    );

    return () => off(pricesRef, "value", unsubscribe as any);
  }, []);

  // ── Simulate live ticks on demo data ──────────────────────────────────────
  // When not connected to a real DB, jitter prices every ~8s so the UI
  // demonstrates the real-time behaviour.
  React.useEffect(() => {
    if (live) return;
    const id = setInterval(() => {
      setPrices(prev =>
        prev.map(p => {
          if (Math.random() > 0.3) return p;                     // ~70% unchanged
          const delta = (Math.random() - 0.48) * p.price * 0.03; // ±3% jitter
          const newPrice = Math.max(10, Math.round(p.price + delta));
          return toVM({ ...p, prevPrice: p.price, price: newPrice, updatedAt: Date.now() });
        })
      );
    }, 8000);
    return () => clearInterval(id);
  }, [live]);

  return { prices, live };
}
