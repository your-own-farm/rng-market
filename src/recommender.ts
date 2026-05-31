// ── Crop recommender ─────────────────────────────────────────────────────────
// Pure function: takes farm inputs + signals (weather, prices) and returns a
// ranked list of crop choices with expected net profit per acre.
//
// Deliberately deterministic and inspectable — every score component is named
// so we can show the farmer *why* a crop made the list.

import { CROPS, CropKB, Season, SoilType, currentSeason } from "./crops";
import { CropPriceVM } from "./types";
import { WeatherData } from "./useWeather";

export interface RecommenderInput {
  state: string | null;
  district: string | null;
  acres: number;
  soil: SoilType | null;
  /** Override the auto-detected season. */
  season?: Season;
  mode: "organic" | "urea";
  prices: CropPriceVM[];
  weather: WeatherData | null;
}

export interface Recommendation {
  crop: CropKB;
  /** Net profit per acre — the primary ranking score. */
  netProfitPerAcre: number;
  grossRevenuePerAcre: number;
  inputCostPerAcre: number;
  expectedYield: number;          // qtl/acre
  expectedPrice: number;          // ₹/qtl
  weatherRisk: "low" | "medium" | "high";
  demand: "rising" | "stable" | "falling";
  confidence: number;             // 0..1
  /** Reasons surfaced in the UI. Each is an i18n key into the crop's notes
   *  plus dynamically generated ones from the engine. */
  reasons: string[];
  daysToHarvest: number;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function recentPriceFor(crop: CropKB, prices: CropPriceVM[], stateName: string | null): { price: number; source: "live" | "msp" } {
  const matches = prices.filter(
    (p) => p.crop.toLowerCase() === crop.id.toLowerCase() || p.crop.toLowerCase().includes(crop.id)
  );
  if (matches.length === 0) return { price: crop.baseFloorPrice, source: "msp" };

  // Prefer same state, else national median.
  if (stateName) {
    const here = matches.filter((p) => p.state === stateName);
    if (here.length > 0) {
      const med = here.map((p) => p.price).sort((a, b) => a - b)[Math.floor(here.length / 2)];
      return { price: med, source: "live" };
    }
  }
  const all = matches.map((p) => p.price).sort((a, b) => a - b);
  return { price: all[Math.floor(all.length / 2)], source: "live" };
}

function weatherAdjustment(crop: CropKB, w: WeatherData | null): { yieldFactor: number; risk: "low" | "medium" | "high" } {
  if (!w) return { yieldFactor: 1, risk: "medium" };

  let yieldFactor = 1;

  // Rain matters more for thirsty crops.
  const rain = w.totalRain7d;
  if (crop.waterNeed === "high") {
    if (rain < 20)        yieldFactor *= 0.75;
    else if (rain > 250)  yieldFactor *= 0.85;
    else                  yieldFactor *= 1.05;
  } else if (crop.waterNeed === "medium") {
    if (rain < 8)         yieldFactor *= 0.9;
    else if (rain > 200)  yieldFactor *= 0.85;
    else                  yieldFactor *= 1.0;
  } else {
    // Low-water crops actually suffer in heavy rain (groundnut, moong, soybean root-rot).
    if (rain > 150)       yieldFactor *= 0.7;
    else                  yieldFactor *= 1.0;
  }

  // Heat & cold.
  if (w.avgTempMax > 40)  yieldFactor *= 0.85;
  if (w.avgTempMin < 5)   yieldFactor *= 0.8;

  yieldFactor = clamp(yieldFactor, 0.4, 1.2);

  const risk: "low" | "medium" | "high" =
    w.riskScore >= 0.6 ? "high" : w.riskScore >= 0.3 ? "medium" : "low";

  return { yieldFactor, risk };
}

function soilFit(crop: CropKB, soil: SoilType | null): number {
  if (!soil) return 0.9; // mild penalty for unknown soil
  return crop.soils.includes(soil) ? 1 : 0.7;
}

function seasonFit(crop: CropKB, season: Season): number {
  return crop.seasons.includes(season) ? 1 : 0;
}

export function recommend(input: RecommenderInput, topN = 5): Recommendation[] {
  const season = input.season ?? currentSeason();

  const all = CROPS.map((crop): Recommendation | null => {
    if (seasonFit(crop, season) === 0) return null;

    const fit = soilFit(crop, input.soil);
    const { yieldFactor, risk } = weatherAdjustment(crop, input.weather);

    const baseYield  = crop.yieldQtlPerAcre.avg;
    const yieldQtl   = baseYield * yieldFactor * (0.85 + 0.15 * fit);
    const price      = recentPriceFor(crop, input.prices, input.state);
    const revenue    = yieldQtl * price.price;
    const cost       = crop.inputCost[input.mode];
    const net        = revenue - cost;

    // Confidence: live price + matching soil + low risk all contribute.
    let confidence = 0.4;
    if (price.source === "live") confidence += 0.2;
    if (input.soil && crop.soils.includes(input.soil)) confidence += 0.2;
    if (input.weather && risk === "low") confidence += 0.15;
    if (input.district) confidence += 0.05;
    confidence = clamp(confidence, 0, 1);

    // Reasons displayed in the UI ("Why this crop?").
    const reasons: string[] = [];
    if (price.source === "live") reasons.push(`reason.live-price`);
    if (input.soil && crop.soils.includes(input.soil)) reasons.push(`reason.soil-match:${input.soil}`);
    if (risk === "low") reasons.push(`reason.weather-good`);
    if (crop.demandTrend === 1) reasons.push(`reason.demand-rising`);
    if (crop.daysToHarvest <= 90) reasons.push(`reason.quick-cycle`);
    if (net > cost) reasons.push(`reason.high-margin`);

    return {
      crop,
      netProfitPerAcre:    Math.round(net),
      grossRevenuePerAcre: Math.round(revenue),
      inputCostPerAcre:    cost,
      expectedYield:       Math.round(yieldQtl),
      expectedPrice:       Math.round(price.price),
      weatherRisk:         risk,
      demand:              crop.demandTrend === 1 ? "rising" : crop.demandTrend === -1 ? "falling" : "stable",
      confidence,
      reasons,
      daysToHarvest:       crop.daysToHarvest,
    };
  }).filter((r): r is Recommendation => r !== null);

  // Rank: net profit primary, confidence as tiebreaker.
  all.sort((a, b) =>
    b.netProfitPerAcre !== a.netProfitPerAcre
      ? b.netProfitPerAcre - a.netProfitPerAcre
      : b.confidence - a.confidence
  );

  return all.slice(0, topN);
}

// ── Reason → i18n key/text helper ─────────────────────────────────────────────
// Each reason is a synthetic key — render it in the UI via this helper so the
// language layer doesn't need to know about the encoding.
export function reasonLabel(reason: string, t: (k: string) => string): string {
  if (reason === "reason.live-price")    return "Live mandi price used in the calculation";
  if (reason === "reason.weather-good")  return "Weather looks favourable for this crop";
  if (reason === "reason.demand-rising") return "Demand has been rising over the last few seasons";
  if (reason === "reason.quick-cycle")   return "Quick cycle — money back within 3 months";
  if (reason === "reason.high-margin")   return "Strong margin even after input costs";
  if (reason.startsWith("reason.soil-match:")) {
    const soil = reason.split(":")[1];
    return `Your soil (${soil}) suits this crop well`;
  }
  return reason;
}
