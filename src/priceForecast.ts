// ── Price forecast ───────────────────────────────────────────────────────────
// Turns a historical Agmarknet series into a forward price estimate at harvest.
//
// Approach:
//   1. Sort points by date.
//   2. Fit a linear regression on (days_from_start, log(price)) — log keeps the
//      slope independent of price magnitude, so a 5%/month rise in tomato and
//      a 5%/month rise in sugarcane both look the same.
//   3. Extrapolate `daysOut` days ahead.
//   4. Compute volatility as the std-dev of daily log-returns — high
//      volatility lowers confidence.
//   5. Apply two domain caps: (a) MSP floor for procurement crops, (b) limit
//      extrapolation to ±25% of current to avoid runaway projections from
//      noisy short series.
//
// This is intentionally simple — the LinkedIn article mentions a Temporal
// Fusion Transformer as the long-term plan; until then the *direction* of the
// signal is what matters most to a farmer.

import { PricePoint } from "./useAgmarknet";

export interface PriceForecast {
  /** Most recent observed price (₹/quintal). */
  today:        number;
  /** Forecast price `daysOut` days from now (₹/quintal). */
  forecast:     number;
  /** Direction shorthand. */
  trend:        "up" | "down" | "flat";
  /** Implied % change per month (signed). */
  trendPctMo:   number;
  /** Coefficient of variation of log returns (0..). Higher = more volatile. */
  volatility:   number;
  /** 0..1 — derived from sample size and volatility. */
  confidence:   number;
  /** Number of distinct trading days that fed the regression. */
  sampleCount:  number;
  /** Source flag for the UI. */
  source:       "history" | "msp" | "demo";
}

const MSP_FLOOR_RATIO = 0.95;  // crops with MSP shouldn't be forecast below 95% of floor
const MAX_EXTRAPOLATION = 0.25; // cap forecast at ±25% of today
const MIN_POINTS = 4;

/** Forecast price for `daysOut` days from now. */
export function forecastPrice(
  history: PricePoint[],
  daysOut: number,
  opts: { mspFloor?: number } = {}
): PriceForecast {
  if (history.length === 0) {
    return { today: 0, forecast: 0, trend: "flat", trendPctMo: 0, volatility: 0, confidence: 0, sampleCount: 0, source: "demo" };
  }

  const sorted = [...history].sort((a, b) => a.date.getTime() - b.date.getTime());
  const today  = sorted[sorted.length - 1].price;

  // Not enough data — return flat forecast, anchored to MSP floor where it
  // applies.
  if (sorted.length < MIN_POINTS) {
    const f = opts.mspFloor ? Math.max(opts.mspFloor * MSP_FLOOR_RATIO, today) : today;
    return {
      today, forecast: Math.round(f),
      trend: "flat", trendPctMo: 0, volatility: 0,
      confidence: 0.25, sampleCount: sorted.length,
      source: opts.mspFloor ? "msp" : "history",
    };
  }

  // Linear regression on (days, log price).
  const t0 = sorted[0].date.getTime();
  const day = 24 * 60 * 60 * 1000;
  const n  = sorted.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const p of sorted) {
    const x = (p.date.getTime() - t0) / day;
    const y = Math.log(p.price);
    sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
  }
  const denom    = n * sumX2 - sumX * sumX;
  const slope    = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // Volatility — std dev of log-returns between consecutive days.
  const returns: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].price <= 0 || sorted[i - 1].price <= 0) continue;
    returns.push(Math.log(sorted[i].price / sorted[i - 1].price));
  }
  let volatility = 0;
  if (returns.length > 1) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const v    = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
    volatility = Math.sqrt(v);
  }

  // Extrapolate `daysOut` ahead.
  const todayDays    = (sorted[sorted.length - 1].date.getTime() - t0) / day;
  const rawForecast  = Math.exp(intercept + slope * (todayDays + daysOut));

  // Cap extrapolation to avoid wild predictions from a noisy 15-point series.
  const lo = today * (1 - MAX_EXTRAPOLATION);
  const hi = today * (1 + MAX_EXTRAPOLATION);
  let forecast = Math.min(hi, Math.max(lo, rawForecast));

  // Apply MSP floor when applicable — government procurement caps downside.
  if (opts.mspFloor) {
    forecast = Math.max(opts.mspFloor * MSP_FLOOR_RATIO, forecast);
  }

  const trendPctMo = (Math.exp(slope * 30) - 1) * 100;
  const trend: PriceForecast["trend"] =
    trendPctMo >  1 ? "up"  :
    trendPctMo < -1 ? "down" : "flat";

  // Confidence: sample count weight + low-volatility bonus.
  const sampleWeight = Math.min(1, n / 21);                 // 3 weeks → full credit
  const volScore     = Math.max(0, 1 - volatility * 6);     // CV > 0.17/day → no credit
  const confidence   = 0.3 + 0.4 * sampleWeight + 0.3 * volScore;

  return {
    today,
    forecast: Math.round(forecast),
    trend, trendPctMo,
    volatility,
    confidence: Math.min(1, confidence),
    sampleCount: n,
    source: "history",
  };
}

/** Build a name→forecast map for the recommender. */
export function forecastMap(
  histories: Record<string, PricePoint[]>,
  daysOutByCrop: Record<string, number>,
  mspFloors: Record<string, number | undefined> = {}
): Map<string, PriceForecast> {
  const out = new Map<string, PriceForecast>();
  for (const [cropId, history] of Object.entries(histories)) {
    const days  = daysOutByCrop[cropId] ?? 90;
    const floor = mspFloors[cropId];
    out.set(cropId, forecastPrice(history, days, { mspFloor: floor }));
  }
  return out;
}
