// ── Open-Meteo weather hook ──────────────────────────────────────────────────
// Free, no API key, no signup, CORS-enabled.
// https://open-meteo.com — open-source, ODbL-licensed forecast data.

import React from "react";

export interface DailyForecast {
  date: string;          // ISO YYYY-MM-DD
  tMax: number;          // °C
  tMin: number;          // °C
  rainMm: number;        // mm
  windKmh: number;       // km/h
  weatherCode: number;   // WMO weather code
}

export interface WeatherData {
  daily: DailyForecast[];
  totalRain7d: number;
  avgTempMax: number;
  avgTempMin: number;
  /** Heuristic risk score 0..1 (higher = riskier for sowing). */
  riskScore: number;
  source: "open-meteo" | "fallback";
}

export interface WeatherState {
  data: WeatherData | null;
  loading: boolean;
  error: string | null;
}

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

function buildUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    latitude:  lat.toFixed(4),
    longitude: lng.toFixed(4),
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "wind_speed_10m_max",
      "weather_code",
    ].join(","),
    timezone: "Asia/Kolkata",
    forecast_days: "7",
  });
  return `${ENDPOINT}?${params.toString()}`;
}

function summarise(daily: DailyForecast[]): Omit<WeatherData, "daily" | "source"> {
  const totalRain7d = daily.reduce((a, d) => a + d.rainMm, 0);
  const avgTempMax  = daily.reduce((a, d) => a + d.tMax, 0) / daily.length;
  const avgTempMin  = daily.reduce((a, d) => a + d.tMin, 0) / daily.length;

  // Risk: heavy rain, frost, or extreme heat each contribute.
  let risk = 0;
  if (totalRain7d > 200) risk += 0.4;
  if (totalRain7d < 10)  risk += 0.2;
  if (avgTempMax > 40)   risk += 0.3;
  if (avgTempMin < 5)    risk += 0.3;
  risk = Math.min(1, risk);

  return { totalRain7d, avgTempMax, avgTempMin, riskScore: risk };
}

/** Fallback synthesised from typical Indian seasonal norms — only used if the API call fails. */
function fallback(lat: number): WeatherData {
  const today = new Date();
  const month = today.getMonth() + 1;
  // Crude seasonal model — south is hotter year-round, north sees winter dip.
  const isSouth = lat < 20;
  const monsoon = month >= 6 && month <= 9;
  const winter  = month === 12 || month <= 2;

  const tMax = winter ? (isSouth ? 30 : 22) : monsoon ? 30 : 35;
  const tMin = winter ? (isSouth ? 20 : 8)  : monsoon ? 24 : 24;
  const rain = monsoon ? 25 : winter ? 1 : 4;

  const daily: DailyForecast[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return {
      date: d.toISOString().slice(0, 10),
      tMax: tMax + (Math.random() * 4 - 2),
      tMin: tMin + (Math.random() * 3 - 1.5),
      rainMm: monsoon ? rain + Math.random() * 20 : Math.max(0, rain - Math.random() * 3),
      windKmh: 8 + Math.random() * 12,
      weatherCode: monsoon ? 61 : winter ? 0 : 1,
    };
  });

  return { daily, ...summarise(daily), source: "fallback" };
}

// In-memory cache so we don't refetch as the user switches tabs.
const cache = new Map<string, { data: WeatherData; at: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function useWeather(lat: number | null, lng: number | null): WeatherState {
  const [state, setState] = React.useState<WeatherState>({ data: null, loading: false, error: null });

  React.useEffect(() => {
    if (lat == null || lng == null) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      setState({ data: hit.data, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    fetch(buildUrl(lat, lng))
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: any) => {
        if (cancelled) return;
        const d = json.daily;
        const daily: DailyForecast[] = d.time.map((date: string, i: number) => ({
          date,
          tMax: d.temperature_2m_max[i],
          tMin: d.temperature_2m_min[i],
          rainMm: d.precipitation_sum[i] ?? 0,
          windKmh: d.wind_speed_10m_max[i] ?? 0,
          weatherCode: d.weather_code[i] ?? 0,
        }));
        const data: WeatherData = { daily, ...summarise(daily), source: "open-meteo" };
        cache.set(key, { data, at: Date.now() });
        setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        const data = fallback(lat);
        cache.set(key, { data, at: Date.now() });
        setState({ data, loading: false, error: String(err.message ?? err) });
      });

    return () => { cancelled = true; };
  }, [lat, lng]);

  return state;
}

// ── WMO weather code → emoji / label ──────────────────────────────────────────
// Reference: https://open-meteo.com/en/docs#weathervariables
export function weatherIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3)  return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  if (code <= 99) return "⛈️";
  return "🌤️";
}
