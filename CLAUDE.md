# rng-market — Kinsar Intelligence (public farmer decision engine)

## Role in the System

The **public, no-login** entry point for farmers. Unlike the other portals
(farmer / customer / broker) which require Firebase Auth, this MFE is designed
to be openable on a ₹500 phone, on 2G, without an account, in the user's own
language — and to answer one question:

> "Which crop should I plant?"

It combines four open-data signals and bundled offline knowledge into a ranked
list of crops with expected net profit per acre.

Firebase site: `market`

---

## Five tabs

| Tab                | Purpose                                                                                |
|--------------------|----------------------------------------------------------------------------------------|
| 🌱 Crop Advisor    | The flagship flow. Wizard: Where → Acres → Soil → Season → ranked recommendations.    |
| 🌤 Weather         | 7-day Open-Meteo forecast + sowing-window verdict.                                     |
| 💰 Mandi Prices    | Live APMC prices (existing real-time grid, now i18n-aware).                            |
| 🧮 Profit Calculator | Pick crop / acres / mode → breakdown with override-able yield, price, input cost.    |
| 📚 Help & Schemes  | Govt schemes, helplines, common pests per crop.                                        |

Active tab persists in `localStorage` so the farmer returns where they left off.

---

## Open-data integrations (all free, no keys, no signup)

| Signal           | Source                          | Module                | Notes                                                        |
|------------------|---------------------------------|-----------------------|--------------------------------------------------------------|
| Weather (7-day)  | **Open-Meteo** (ODbL)           | `useWeather.ts`       | 1-hour in-memory cache; offline fallback synthesises a seasonal estimate. |
| Reverse geocode  | **OpenStreetMap Nominatim**     | `useGeocode.ts`       | Snaps to nearest known district when offline.                |
| Soil composition | **SoilGrids by ISRIC** (CC-BY)  | `useSoil.ts`          | 24-hour cache; classifies into `SoilType` taxonomy.          |
| Mandi prices     | **Firebase RTDB → data.gov.in → demo** | `usePrices.ts`, `useAgmarknet.ts` | Three-tier price chain. Firebase first (pre-aggregated by the Python `market-price-agent`), then a direct browser call to **data.gov.in OGD Platform** (Agmarknet resource `9ef84268-d588-465a-a308-a864a43d0070`) when RTDB is empty, finally bundled `DEMO_PRICES` so the UI never goes blank. |
| Price history & 90-day forecast | **data.gov.in (Agmarknet)** | `useAgmarknet.ts`, `priceForecast.ts` | Per-crop daily series, collapsed to one modal price per arrival_date. The forecast fits a linear regression on `(days, log(price))`, caps extrapolation at ±25%, applies the MSP floor where it exists, and reports volatility-adjusted confidence. The recommender uses this forecast in place of its inline heuristic whenever ≥4 distinct trading days are available. |
| Speech / TTS     | **Web Speech API** (browser)    | `tts.ts`              | Picks best matching `BCP47` voice; silently no-ops if absent.|
| Geolocation      | **`navigator.geolocation`**     | `useGeocode.ts`       | Permission prompted on first "Use my location" click.        |

---

## Languages (extensible)

Defined in `i18n.ts`. Currently shipped: **English, Hindi, Marathi, Tamil**.
Active locale lives in `localStorage` under `kinsar.locale`; falls back to the
browser language, then English.

To add a language:
1. Append the code to `Locale` and `LOCALES` in `i18n.ts`.
2. Add a translation dictionary keyed by every key in `en`.
3. Add the BCP47 tag to the `BCP47` map (used by Web Speech).
4. Add native crop names to `CROPS[].names` in `crops.ts` where they exist.

Missing keys silently fall back to English.

---

## Crop knowledge base (`crops.ts`)

Bundled offline so the recommender works without any network at all. Per crop:

- Sowing months (1–12) and seasons (`kharif` | `rabi` | `zaid`)
- Suitable soils (`alluvial`, `black`, `red`, `laterite`, `sandy`, `loamy`, `clay`)
- Water need (`low` | `medium` | `high`)
- Yield range (qtl/acre)
- Input cost per acre by mode (`organic` vs `urea`)
- MSP / floor price
- Demand trend (-1 / 0 / +1)
- Pests
- Native-language names + 2–3 free-text notes per language

Numbers are conservative averages drawn from public IARI / ICAR / state
agriculture department bulletins. Treat them as starting points — the
calculator lets the farmer override every value.

---

## Recommender (`recommender.ts`)

Pure function, fully inspectable. For each crop in the catalog:

```
1. Reject if not in the chosen season.
2. yieldFactor = base * weather adjustment (water need × rain × heat / cold)
3. soilFit    = 1 if soil matches, 0.7 otherwise (0.9 if unknown)
4. price      = median of live mandi rows in chosen state
                ↓ fallback ↓
                national median ↓ fallback ↓ crop.baseFloorPrice
5. revenue    = yield * price
6. cost       = crop.inputCost[mode]
7. net        = revenue - cost
8. confidence = 0.4 + bonuses for: live price, soil match, weather low-risk, district known
9. reasons    = synthetic keys ("reason.live-price", "reason.soil-match:black", …)
              shown in the "Why this crop?" disclosure.
```

Ranked by net profit primary, confidence as tiebreaker. Top 5 returned.

---

## Module Federation

```js
// rng-market/webpack.config.js
name: "marketApp"
exposes: {
  "./App":         "./src/App",          // full Kinsar Intelligence page
  "./PriceTicker": "./src/PriceTicker",  // compact ticker for embedding elsewhere
}
```

Host shell mounts `<App />` for the `/market` route. `PriceTicker` is unchanged
and can still be lazy-loaded into the farmer / customer portals as before.

---

## Usage in other MFEs

```tsx
const PriceTicker = React.lazy(() => import("marketApp/PriceTicker"));
<PriceTicker stateFilter="Maharashtra" maxItems={8} />
```

Or embed the whole experience:

```tsx
const KinsarIntelligence = React.lazy(() => import("marketApp/App"));
<KinsarIntelligence />
```

---

## Performance / 2G considerations

- **No images** outside emoji.
- All open-data API calls are **memoised in-memory** for the session
  (1 hour for weather, 24 hours for soil).
- Fallbacks ensure the app keeps working when every external API is blocked.
- All translations + crop knowledge are bundled — zero network dependency for
  the core flow once the JS is loaded.
- Module Federation singletons keep the parcel within the host shell's React.

---

## What this is NOT

- It does not collect any personal data.
- It does not store anything server-side — only `localStorage` on the user's
  device (last inputs, last locale, active tab).
- Recommendations are **decision support**, not financial advice. The UI
  surfaces "Verify with local experts." on every results page.

---

## data.gov.in API key

The Agmarknet client expects a free OGD Platform key:

```env
# rng-market/.env.preview (or .env)
VITE_DATA_GOV_KEY=<your-key-from-https://data.gov.in/user>
```

When the key is **absent** the client returns `[]` and the page silently falls
back to Firebase RTDB / bundled demo data — no errors surfaced to the farmer.
When the key is **present** the chain becomes Firebase → data.gov.in → demo,
and the `DecisionEngine` opportunistically fetches per-crop history for the
top recommendations and re-ranks them with the regression-based 90-day
forecast.

CORS: data.gov.in supports cross-origin browser calls; no proxy needed.

Rate limits: free keys allow ~5,000 calls / day. The client caches snapshots
for 30 minutes and per-crop history for 6 hours, so a typical farmer session
uses ~5 calls.

---

## Notes

- The Python `market-price-agent` only runs Mon–Sat, 6 AM–8 PM IST. Prices may
  be stale on Sundays or out of hours — the "DEMO · Simulated" badge surfaces
  this clearly.
- Nominatim's [usage policy](https://operations.osmfoundation.org/policies/nominatim/)
  is fair-use; if traffic grows past ~1 req/s, switch to a self-hosted
  Nominatim instance or Photon.
- SoilGrids occasionally rate-limits; the `useSoil` hook falls back to the
  district's hard-coded soil hint silently.
