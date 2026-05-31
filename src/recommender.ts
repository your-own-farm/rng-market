// ── Crop recommender ─────────────────────────────────────────────────────────
// Pure, inspectable. Given soil + weather + live prices, returns for each
// suitable crop:
//   • a per-factor yield multiplier (so the UI can show *why* the yield is what
//     it is — soil match, NPK, pH, rainfall, heat/cold, organic-vs-chemical),
//   • an organic vs chemical net-profit comparison,
//   • a 90-day price forecast based on demand momentum + seasonal supply,
//   • soil / weather match percentages for the comparison table.
//
// The farmer enters very little — location and acres. Every other number on
// screen is derived here.

import { CROPS, CropKB, Season, SoilType, NutrientLevel, currentSeason } from "./crops";
import { CropPriceVM } from "./types";
import { WeatherData } from "./useWeather";
import { SoilData } from "./useSoil";
import { PriceForecast } from "./priceForecast";

export interface RecommenderInput {
  state: string | null;
  district: string | null;
  acres: number;
  /** Active season — auto-derived from the calendar if not provided. */
  season?: Season;
  prices: CropPriceVM[];
  weather: WeatherData | null;
  soil: SoilData | null;
  /** Optional: per-crop 90-day forecast derived from data.gov.in history.
   *  When supplied, replaces the inline forecast heuristic. */
  forecasts?: Map<string, PriceForecast>;
}

/** Each factor in [0..1.3]. 1.0 = neutral, >1 boosts yield, <1 cuts yield. */
export interface YieldFactors {
  soilType:    number;   // does the crop accept this soil family?
  nutrients:   number;   // NPK match
  ph:          number;   // is pH inside the crop's tolerated band?
  rainfall:    number;   // 7-day forecast rain vs crop water need
  temperature: number;   // heat / cold / frost stress
  mode:        number;   // organic = crop.organicYieldRatio, chemical = 1.0
}

export interface ModeOutcome {
  mode:           "organic" | "chemical";
  yieldQtl:       number;       // qtl/acre after every factor applied
  cost:           number;       // ₹/acre input cost in this mode
  revenue:        number;       // ₹/acre revenue at expected sell price
  net:            number;       // ₹/acre net profit
  factors:        YieldFactors; // breakdown — same for both modes except `mode`
}

export interface Recommendation {
  crop:           CropKB;
  organic:        ModeOutcome;
  chemical:       ModeOutcome;
  bestMode:       "organic" | "chemical";
  bestNet:        number;
  /** Today's median mandi price (₹/quintal) for this crop in the chosen state. */
  priceToday:     number;
  /** 90-day forward price at expected harvest (₹/quintal). */
  priceAtHarvest: number;
  priceSource:    "live" | "msp";
  /** Where the harvest-price projection came from. */
  forecastSource: "history" | "heuristic" | "msp";
  /** Implied % price change per month from history regression — when available. */
  priceTrendPctMo: number | null;
  /** 0..1 confidence in the forecast itself (separate from overall confidence). */
  forecastConfidence: number | null;
  /** 0..100 — how well the soil suits this crop. */
  soilMatchPct:    number;
  /** 0..100 — how well current weather suits this crop. */
  weatherMatchPct: number;
  weatherRisk:   "low" | "medium" | "high";
  demand:        "rising" | "stable" | "falling";
  confidence:    number;     // 0..1
  reasons:       string[];   // synthetic keys → reasonLabel()
  daysToHarvest: number;
  harvestMonth:  number;     // 1..12 — when the crop will hit the mandi
}

// ── Utilities ─────────────────────────────────────────────────────────────────
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function levelScore(have: NutrientLevel, need: NutrientLevel): number {
  // perfect match → 1.0, one notch off → 0.85, two notches off → 0.7
  const order: NutrientLevel[] = ["low", "medium", "high"];
  const diff = Math.abs(order.indexOf(have) - order.indexOf(need));
  // If we *have* high and only *need* medium, that's fine (not a penalty).
  if (order.indexOf(have) >= order.indexOf(need)) return 1.0;
  return diff === 1 ? 0.85 : 0.7;
}

function nutrientFactor(soil: SoilData | null, crop: CropKB): number {
  if (!soil) return 0.95;
  const n = levelScore(soil.fertility.n, crop.nutrientNeed.n);
  const p = levelScore(soil.fertility.p, crop.nutrientNeed.p);
  const k = levelScore(soil.fertility.k, crop.nutrientNeed.k);
  // N matters most for cereals/leafy, but a simple average is robust enough.
  return clamp((n + p + k) / 3, 0.7, 1.05);
}

function phFactor(soil: SoilData | null, crop: CropKB): number {
  if (!soil || soil.ph == null) return 0.95;
  const [lo, hi] = crop.phRange;
  if (soil.ph >= lo && soil.ph <= hi) return 1.0;
  const dist = soil.ph < lo ? lo - soil.ph : soil.ph - hi;
  return clamp(1 - dist * 0.15, 0.7, 1.0);
}

function soilTypeFactor(soil: SoilData | null, crop: CropKB): number {
  if (!soil) return 0.9;
  return crop.soils.includes(soil.classified) ? 1.0 : 0.78;
}

function rainfallFactor(w: WeatherData | null, crop: CropKB): number {
  if (!w) return 1.0;
  const rain = w.totalRain7d;
  switch (crop.waterNeed) {
    case "high":
      if (rain < 20)        return 0.78;
      if (rain > 250)       return 0.88;
      return 1.06;
    case "medium":
      if (rain < 8)         return 0.92;
      if (rain > 200)       return 0.86;
      return 1.0;
    case "low":
      if (rain > 150)       return 0.72;
      return 1.0;
  }
}

function temperatureFactor(w: WeatherData | null): number {
  if (!w) return 1.0;
  let f = 1.0;
  if (w.avgTempMax > 40) f *= 0.83;
  if (w.avgTempMax > 44) f *= 0.85;
  if (w.avgTempMin < 8)  f *= 0.88;
  if (w.avgTempMin < 3)  f *= 0.85;
  return clamp(f, 0.55, 1.05);
}

function weatherRiskFromFactor(f: YieldFactors): "low" | "medium" | "high" {
  const combined = f.rainfall * f.temperature;
  if (combined < 0.78) return "high";
  if (combined < 0.94) return "medium";
  return "low";
}

// ── Price discovery ──────────────────────────────────────────────────────────
function priceToday(crop: CropKB, prices: CropPriceVM[], stateName: string | null): { price: number; source: "live" | "msp" } {
  const m = prices.filter((p) =>
    p.crop.toLowerCase() === crop.id.toLowerCase() || p.crop.toLowerCase().includes(crop.id)
  );
  if (m.length === 0) return { price: crop.baseFloorPrice, source: "msp" };
  if (stateName) {
    const here = m.filter((p) => p.state === stateName);
    if (here.length > 0) {
      const sorted = here.map((p) => p.price).sort((a, b) => a - b);
      return { price: sorted[Math.floor(sorted.length / 2)], source: "live" };
    }
  }
  const all = m.map((p) => p.price).sort((a, b) => a - b);
  return { price: all[Math.floor(all.length / 2)], source: "live" };
}

/** Tiny forward-price heuristic — supply glut at harvest depresses prices,
 *  demand momentum lifts them. Multiplies today's price by a factor in
 *  roughly 0.85..1.20.  The PDF's full Temporal Fusion Transformer would
 *  replace this; until then we make the *direction* visible to the farmer. */
function priceAtHarvest(crop: CropKB, today: number, daysOut: number, season: Season): number {
  let f = 1.0;
  // Demand momentum.
  if (crop.demandTrend === 1)  f *= 1.06;
  if (crop.demandTrend === -1) f *= 0.94;
  // Glut effect — short-cycle crops harvested by everyone at once.
  if (daysOut <= 120 && (season === "kharif" || season === "rabi")) f *= 0.93;
  // MSP crops have a hard floor — clamp downside.
  if (crop.baseFloorPrice && today < crop.baseFloorPrice * 1.05) {
    return Math.max(crop.baseFloorPrice, Math.round(today * f));
  }
  return Math.round(today * f);
}

// ── Match percentages for the comparison table ────────────────────────────────
function asPct(...factors: number[]): number {
  const product = factors.reduce((a, b) => a * b, 1);
  return Math.round(clamp(product, 0, 1.05) * 100);
}

// ── Main entry ────────────────────────────────────────────────────────────────
export function recommend(input: RecommenderInput, topN = 5): Recommendation[] {
  const season = input.season ?? currentSeason();

  const candidates = CROPS.filter((c) => c.seasons.includes(season))
    .map<Recommendation>((crop) => {
      // Shared factors across both modes.
      const f: YieldFactors = {
        soilType:    soilTypeFactor(input.soil, crop),
        nutrients:   nutrientFactor(input.soil, crop),
        ph:          phFactor(input.soil, crop),
        rainfall:    rainfallFactor(input.weather, crop),
        temperature: temperatureFactor(input.weather),
        mode:        1.0,   // overridden per-mode below
      };

      const baseYield = crop.yieldQtlPerAcre.avg;
      const sharedMul = f.soilType * f.nutrients * f.ph * f.rainfall * f.temperature;

      const { price, source } = priceToday(crop, input.prices, input.state);
      const today = new Date();
      const harvestDate = new Date(today.getTime() + crop.daysToHarvest * 86400000);
      const harvestMonth = harvestDate.getMonth() + 1;

      // Prefer the data.gov.in-derived forecast when it's been supplied
      // and looks credible; fall back to the inline heuristic otherwise.
      const fc = input.forecasts?.get(crop.id);
      const useHistory = !!fc && fc.source === "history" && fc.sampleCount >= 4;

      const fwdPrice = useHistory && fc
        ? fc.forecast
        : priceAtHarvest(crop, price, crop.daysToHarvest, season);
      const forecastSource: Recommendation["forecastSource"] =
        useHistory ? "history" :
        crop.baseFloorPrice && price < crop.baseFloorPrice * 1.05 ? "msp" : "heuristic";
      const priceTrendPctMo    = useHistory && fc ? fc.trendPctMo : null;
      const forecastConfidence = useHistory && fc ? fc.confidence : null;

      // For profit math we use the harvest price the farmer would actually realise.
      const realisedPrice = fwdPrice;

      // Build each mode outcome.
      const chemical: ModeOutcome = {
        mode: "chemical",
        yieldQtl: Math.round(baseYield * sharedMul * 1.0),
        cost:     crop.inputCost.urea,
        revenue:  0, net: 0,
        factors:  { ...f, mode: 1.0 },
      };
      chemical.revenue = Math.round(chemical.yieldQtl * realisedPrice);
      chemical.net     = chemical.revenue - chemical.cost;

      const organic: ModeOutcome = {
        mode: "organic",
        yieldQtl: Math.round(baseYield * sharedMul * crop.organicYieldRatio),
        cost:     crop.inputCost.organic,
        revenue:  0, net: 0,
        factors:  { ...f, mode: crop.organicYieldRatio },
      };
      organic.revenue = Math.round(organic.yieldQtl * realisedPrice);
      organic.net     = organic.revenue - organic.cost;

      const bestMode: "organic" | "chemical" = organic.net >= chemical.net ? "organic" : "chemical";
      const bestNet = Math.max(organic.net, chemical.net);

      // Confidence: live price + good signal coverage + a real history-based
      // forecast all push the dial up.
      let confidence = 0.35;
      if (source === "live")          confidence += 0.15;
      if (input.soil?.source === "soilgrids") confidence += 0.15;
      if (input.weather?.source === "open-meteo") confidence += 0.1;
      if (useHistory && fc)           confidence += 0.15 * fc.confidence;
      if (input.district)             confidence += 0.05;

      // Reasons surfaced to the UI.
      const reasons: string[] = [];
      if (source === "live")                            reasons.push("reason.live-price");
      if (input.soil && crop.soils.includes(input.soil.classified)) reasons.push(`reason.soil-match:${input.soil.classified}`);
      if (f.rainfall * f.temperature >= 0.95)           reasons.push("reason.weather-good");
      if (crop.demandTrend === 1)                       reasons.push("reason.demand-rising");
      if (crop.daysToHarvest <= 90)                     reasons.push("reason.quick-cycle");
      if (bestNet > 30000)                              reasons.push("reason.high-margin");
      if (input.soil && f.nutrients >= 1.0)             reasons.push("reason.nutrients-good");
      if (input.soil && f.ph >= 0.98)                   reasons.push("reason.ph-good");
      if (fwdPrice > price)                             reasons.push("reason.price-forecast-up");
      if (useHistory && fc && fc.sampleCount >= 10)     reasons.push("reason.history-forecast");

      return {
        crop,
        organic, chemical,
        bestMode,
        bestNet,
        priceToday:        price,
        priceAtHarvest:    fwdPrice,
        priceSource:       source,
        forecastSource,
        priceTrendPctMo,
        forecastConfidence,
        soilMatchPct:      asPct(f.soilType, f.nutrients, f.ph),
        weatherMatchPct:   asPct(f.rainfall, f.temperature),
        weatherRisk:       weatherRiskFromFactor(f),
        demand:            crop.demandTrend === 1 ? "rising" : crop.demandTrend === -1 ? "falling" : "stable",
        confidence:        clamp(confidence, 0, 1),
        reasons,
        daysToHarvest:     crop.daysToHarvest,
        harvestMonth,
      };
    });

  candidates.sort((a, b) =>
    b.bestNet !== a.bestNet ? b.bestNet - a.bestNet : b.confidence - a.confidence
  );

  return candidates.slice(0, topN);
}

// ── i18n-light helper used by the UI to render reason keys ────────────────────
export function reasonLabel(reason: string, t: (k: string) => string): string {
  if (reason === "reason.live-price")          return "Live mandi price used in calculation";
  if (reason === "reason.weather-good")        return "Weather forecast favours this crop";
  if (reason === "reason.demand-rising")       return "Demand has been rising over recent seasons";
  if (reason === "reason.quick-cycle")         return "Quick cycle — money back in under 3 months";
  if (reason === "reason.high-margin")         return "Strong margin even after input costs";
  if (reason === "reason.nutrients-good")      return "Soil NPK matches the crop's needs";
  if (reason === "reason.ph-good")             return "Soil pH falls inside this crop's optimal band";
  if (reason === "reason.price-forecast-up")   return "Price expected to rise by harvest";
  if (reason === "reason.history-forecast")    return "Forecast based on 3+ weeks of mandi history (data.gov.in)";
  if (reason.startsWith("reason.soil-match:")) {
    const soil = reason.split(":")[1];
    return `Your soil (${soil}) suits this crop well`;
  }
  return reason;
}
