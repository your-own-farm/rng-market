// ── Crop Decision Engine ─────────────────────────────────────────────────────
// Minimal-input flow inspired by the Kinsar Intelligence vision:
//
//   The farmer only provides:
//     1. Location  (geolocation OR a state/district fallback)
//     2. Acres     (acre presets + custom)
//
//   Everything else is auto-derived:
//     • Season       — from the calendar.
//     • Soil type    — from SoilGrids (or the district default offline).
//     • NPK / pH     — from SoilGrids.
//     • Weather      — from Open-Meteo (7-day forecast).
//     • Mandi price  — from Firebase RTDB (data.gov.in pipeline).
//     • Mode         — both organic and chemical computed side-by-side.
//     • Yield        — base × soil × NPK × pH × rainfall × temperature × mode.
//
//   The result is a head-to-head comparison table where the best value in
//   every metric is highlighted, so the farmer can see at a glance which
//   crop wins on profit, which on yield, which on demand, etc.

import React from "react";
import { useI18n } from "../i18n";
import { STATES, findState, findDistrict, District, StateGeo } from "../geo";
import { cropName, cropNotes, currentSeason } from "../crops";
import { CropPriceVM } from "../types";
import { useWeather } from "../useWeather";
import { useSoil } from "../useSoil";
import { getCurrentLocation } from "../useGeocode";
import { recommend, Recommendation, reasonLabel, YieldFactors } from "../recommender";
import { speak, stop, isSupported as ttsSupported } from "../tts";
import {
  Dropdown, DropdownOption, Pill, formatINR,
  CARD, CARD_HI, BORDER, GREEN, RED, AMBER, BLUE, VIOLET, MUTED, TEXT, TEXT_DIM,
} from "../ui";

const STORAGE_KEY = "kinsar.advisor.inputs";

interface AdvisorState {
  state: string;
  district: string;
  acres: number;
}

const DEFAULTS: AdvisorState = { state: "", district: "", acres: 1 };

function load(): AdvisorState {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch { return DEFAULTS; }
}
function save(s: AdvisorState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

const ACRE_PRESETS = [1, 2, 5, 10];

interface Props { prices: CropPriceVM[] }

const DecisionEngine: React.FC<Props> = ({ prices }) => {
  const { t, locale } = useI18n();
  const [s, setS]            = React.useState<AdvisorState>(() => load());
  const [locating, setLocating] = React.useState(false);
  const [locError, setLocError] = React.useState<string | null>(null);
  const [showManual, setShowManual] = React.useState<boolean>(() => !!load().state);
  const [speaking, setSpeaking]     = React.useState(false);
  const [customAcres, setCustomAcres] = React.useState<boolean>(() => !ACRE_PRESETS.includes(load().acres));

  const update = (patch: Partial<AdvisorState>) => setS((prev) => {
    const next = { ...prev, ...patch };
    save(next);
    return next;
  });

  const stateObj: StateGeo | undefined = s.state ? findState(s.state) : undefined;
  const districtObj: District | undefined =
    s.state && s.district ? findDistrict(s.state, s.district) : undefined;

  const lat = districtObj?.lat ?? null;
  const lng = districtObj?.lng ?? null;

  const weather = useWeather(lat, lng);
  const soilApi = useSoil(lat, lng, districtObj?.soil ?? "loamy");

  // Effective season — always auto-derived.
  const season = currentSeason();

  const recs: Recommendation[] = React.useMemo(() => {
    if (!districtObj) return [];
    return recommend({
      state: s.state || null,
      district: s.district || null,
      acres: s.acres,
      season,
      prices,
      weather: weather.data,
      soil: soilApi.data,
    });
  }, [s, districtObj, prices, weather.data, soilApi.data, season]);

  // ── Geolocation handler ───────────────────────────────────────────────────
  const useMyLocation = async () => {
    setLocating(true); setLocError(null);
    try {
      const g = await getCurrentLocation();
      if (g.state && g.district) {
        update({ state: g.state.name, district: g.district.name });
        setShowManual(true);
      } else {
        setLocError("Could not detect your district. Please pick it manually.");
        setShowManual(true);
      }
    } catch (err: any) {
      setLocError(err?.message ?? "Location access denied. Pick manually below.");
      setShowManual(true);
    } finally {
      setLocating(false);
    }
  };

  // ── Read top recommendation aloud ─────────────────────────────────────────
  const readAloud = () => {
    if (recs.length === 0) return;
    const top = recs[0];
    const txt = [
      cropName(top.crop, locale),
      `${t("row.profit.best")}: ${formatINR(top.bestNet)} ${t("card.per.acre")}.`,
      `${t("row.yield.chemical")}: ${top.chemical.yieldQtl} ${t("card.unit.qtl")}.`,
      `${t("row.price.forecast")}: ${formatINR(top.priceAtHarvest)} ${t("card.unit.qtl.short")}.`,
    ].join(". ");
    const ok = speak(txt, locale);
    setSpeaking(ok);
    if (ok) {
      const id = setInterval(() => {
        if (!window.speechSynthesis.speaking) { setSpeaking(false); clearInterval(id); }
      }, 500);
    }
  };

  const stateOptions: DropdownOption[] = STATES.map((st) => ({ value: st.name, label: st.name }));
  const districtOptions: DropdownOption[] = stateObj
    ? stateObj.districts.map((d) => ({ value: d.name, label: d.name }))
    : [];

  const ready = !!districtObj && s.acres > 0;
  const isComputing = ready && (weather.loading || soilApi.loading);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, rgba(34,197,94,0.10), rgba(99,102,241,0.06))",
        border: `1px solid ${BORDER}`, borderRadius: 20,
        padding: "1.8rem 1.6rem", marginBottom: "1.4rem",
      }}>
        <div style={{ fontSize: "0.78rem", fontWeight: 700, color: GREEN, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
          🌾 {t("brand.title")}
        </div>
        <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2.3rem)", fontWeight: 900, color: TEXT, lineHeight: 1.15, letterSpacing: "-0.03em", marginBottom: 10 }}>
          {t("advisor.auto.headline")}
        </h1>
        <p style={{ fontSize: "0.98rem", color: TEXT_DIM, lineHeight: 1.6, maxWidth: 680 }}>
          {t("advisor.auto.sub")}
        </p>
      </div>

      {/* Input card */}
      <div style={{
        background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16,
        padding: "1.3rem", marginBottom: "1.5rem",
      }}>
        {/* Location row — geolocation as the primary, manual as fallback */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.6rem" }}>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            style={{
              padding: "0.85rem 1.4rem", borderRadius: 12,
              background: locating ? "rgba(34,197,94,0.10)" : GREEN,
              border: `1px solid ${GREEN}`,
              color: locating ? GREEN : "#0b1120",
              fontSize: 14, fontWeight: 800, letterSpacing: "0.02em",
              cursor: locating ? "wait" : "pointer", fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", gap: 8,
            }}
          >
            {locating ? `⌛ ${t("advisor.locating")}` : `📡 ${t("advisor.auto.detect")}`}
          </button>
          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            style={{
              padding: "0.55rem 0.9rem",
              background: "transparent", border: "none",
              color: VIOLET, fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", textDecoration: "underline",
            }}
          >
            {t("advisor.auto.manual")}
          </button>
        </div>
        {locError && <p style={{ fontSize: 12, color: AMBER, margin: "0 0 8px" }}>⚠ {locError}</p>}

        {showManual && (
          <div style={{ display: "grid", gap: "0.65rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: "1rem" }}>
            <Dropdown icon="📍" placeholder={t("advisor.state")}    value={s.state}    options={stateOptions}    onChange={(v) => update({ state: v, district: "" })} />
            <Dropdown icon="🏘️" placeholder={t("advisor.district")} value={s.district} options={districtOptions} onChange={(v) => update({ district: v })} />
          </div>
        )}

        {/* Acres pills */}
        <div style={{ marginTop: "0.6rem" }}>
          <label style={{ display: "block", fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
            {t("advisor.auto.size")}
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ACRE_PRESETS.map((n) => {
              const active = !customAcres && s.acres === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => { update({ acres: n }); setCustomAcres(false); }}
                  style={pillBtn(active)}
                >
                  {n} {t("advisor.acres")}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setCustomAcres(true)}
              style={pillBtn(customAcres)}
            >
              {t("advisor.auto.acres.other")}…
            </button>
            {customAcres && (
              <input
                type="number"
                min={0.25} step={0.25}
                value={s.acres}
                onChange={(e) => update({ acres: Math.max(0.25, Number(e.target.value) || 0) })}
                autoFocus
                style={{
                  background: CARD_HI, border: `1px solid ${BORDER}`,
                  borderRadius: 999, color: TEXT, padding: "0.45rem 0.9rem",
                  fontSize: 14, width: 100, outline: "none", fontFamily: "inherit",
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Detected card */}
      {districtObj && (
        <DetectedCard
          state={s.state}
          district={s.district}
          soil={soilApi.data}
          weather={weather.data}
          loading={isComputing}
        />
      )}

      {/* Results */}
      {!districtObj ? (
        <EmptyState />
      ) : isComputing && recs.length === 0 ? (
        <Loading text={t("advisor.auto.computing")} />
      ) : (
        <>
          {recs.length > 0 && <WinnerBanner top={recs[0]} acres={s.acres} />}

          {/* Speak controls */}
          {ttsSupported() && recs.length > 0 && (
            <div style={{ display: "flex", gap: 8, margin: "0 0 14px", flexWrap: "wrap" }}>
              {!speaking ? (
                <button onClick={readAloud} style={speakBtn(GREEN)}>{t("advisor.read.aloud")}</button>
              ) : (
                <button onClick={stop} style={speakBtn(AMBER)}>{t("advisor.stop.reading")}</button>
              )}
            </div>
          )}

          {recs.length > 0 && <ComparisonTable recs={recs} acres={s.acres} />}
          {recs.length > 0 && <FactorTable    recs={recs} />}
          {recs.length > 0 && <WhyCards       recs={recs} />}
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Detected card — visible proof that the engine has auto-filled everything.
// ─────────────────────────────────────────────────────────────────────────────
const DetectedCard: React.FC<{
  state: string;
  district: string;
  soil: ReturnType<typeof useSoil>["data"];
  weather: ReturnType<typeof useWeather>["data"];
  loading: boolean;
}> = ({ state, district, soil, weather, loading }) => {
  const { t } = useI18n();

  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16,
      padding: "1rem 1.2rem", marginBottom: "1.5rem",
    }}>
      <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
        {t("advisor.auto.detected")}
      </div>
      <div style={{ display: "grid", gap: "0.55rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <Tile icon="📍" label={`${district}, ${state}`} sub={`${t("season.auto")} · ${t("season." + currentSeason())}`} />
        <Tile
          icon="🪨"
          label={soil ? t(`soil.${soil.classified}`) : "—"}
          sub={
            soil
              ? `${t("soil.ph.label")} ${soil.ph?.toFixed(1) ?? "—"} · N ${t(`soil.fertility.${soil.fertility.n}`)}`
              : (loading ? "…" : "")
          }
          source={soil?.source === "soilgrids" ? "SoilGrids" : soil ? t("ui.offline") : undefined}
        />
        <Tile
          icon="🌤"
          label={weather ? `${weather.avgTempMax.toFixed(0)}° / ${weather.avgTempMin.toFixed(0)}°C` : (loading ? "…" : "—")}
          sub={weather ? `${weather.totalRain7d.toFixed(0)} mm ${t("weather.rain.7d").toLowerCase()}` : ""}
          source={weather?.source === "open-meteo" ? "Open-Meteo" : weather ? t("ui.offline") : undefined}
        />
        {soil && (
          <Tile
            icon="🧪"
            label={`NPK · ${shortFert(soil.fertility.n)} ${shortFert(soil.fertility.p)} ${shortFert(soil.fertility.k)}`}
            sub={`SOC ${soil.organicCarbon?.toFixed(1) ?? "—"} g/kg`}
          />
        )}
      </div>
    </div>
  );
};

const Tile: React.FC<{ icon: string; label: string; sub?: string; source?: string }> = ({ icon, label, sub, source }) => (
  <div style={{ background: CARD_HI, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0.7rem 0.9rem" }}>
    <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, lineHeight: 1.2 }}>
      <span style={{ marginRight: 6 }}>{icon}</span>{label}
    </div>
    {sub && <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{sub}</div>}
    {source && (
      <div style={{ marginTop: 6 }}>
        <Pill color={source.startsWith("Soil") || source.startsWith("Open") ? GREEN : MUTED}>{source}</Pill>
      </div>
    )}
  </div>
);

function shortFert(l: "low" | "medium" | "high"): string {
  return l === "low" ? "L" : l === "high" ? "H" : "M";
}

// ─────────────────────────────────────────────────────────────────────────────
// Winner banner — single biggest takeaway.
// ─────────────────────────────────────────────────────────────────────────────
const WinnerBanner: React.FC<{ top: Recommendation; acres: number }> = ({ top, acres }) => {
  const { t, locale } = useI18n();
  const total = top.bestNet * acres;
  const ureaWins = top.bestMode === "chemical";
  return (
    <div style={{
      background: `linear-gradient(135deg, ${GREEN}22, ${GREEN}08)`,
      border: `1px solid ${GREEN}55`,
      borderRadius: 18, padding: "1.4rem 1.5rem", marginBottom: "1.3rem",
      display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
    }}>
      <span style={{ fontSize: "3rem", lineHeight: 1 }}>{top.crop.emoji}</span>
      <div style={{ flex: "1 1 240px", minWidth: 200 }}>
        <div style={{ fontSize: 11, color: GREEN, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          🏆 {t("compare.winner")}
        </div>
        <div style={{ fontSize: "1.5rem", fontWeight: 900, color: TEXT, letterSpacing: "-0.02em" }}>
          {cropName(top.crop, locale)}
        </div>
        <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 2 }}>
          {ureaWins ? t("mode.best.chemical") : t("mode.best.organic")} · {top.daysToHarvest} {t("card.days").toLowerCase()}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {t("card.profit")} ({acres} {t("advisor.acres")})
        </div>
        <div style={{ fontSize: "2rem", fontWeight: 900, color: GREEN, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          {formatINR(total)}
        </div>
        <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 2 }}>
          {formatINR(top.bestNet)} {t("card.per.acre")}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Comparison table — crops as columns, metrics as rows, best in row highlighted.
// ─────────────────────────────────────────────────────────────────────────────
type RowKind = "best" | "money" | "qty" | "pct" | "label";

interface CompareRow {
  key: string;
  label: string;
  kind: RowKind;
  /** Higher = better (for highlight), unless `lowerIsBetter`. */
  values: Array<{ raw: number; display: string; tone?: string }>;
  lowerIsBetter?: boolean;
}

const ComparisonTable: React.FC<{ recs: Recommendation[]; acres: number }> = ({ recs, acres }) => {
  const { t, locale } = useI18n();

  const rows: CompareRow[] = [
    {
      key: "best-net", label: t("row.profit.best"), kind: "best",
      values: recs.map((r) => ({ raw: r.bestNet * acres, display: formatINR(r.bestNet * acres) })),
    },
    {
      key: "net-chem", label: t("row.profit.chemical"), kind: "money",
      values: recs.map((r) => ({ raw: r.chemical.net, display: formatINR(r.chemical.net) })),
    },
    {
      key: "net-org", label: t("row.profit.organic"), kind: "money",
      values: recs.map((r) => ({ raw: r.organic.net, display: formatINR(r.organic.net) })),
    },
    {
      key: "yield-chem", label: t("row.yield.chemical"), kind: "qty",
      values: recs.map((r) => ({ raw: r.chemical.yieldQtl, display: `${r.chemical.yieldQtl} ${t("card.unit.qtl")}` })),
    },
    {
      key: "price-now", label: t("row.price.now"), kind: "money",
      values: recs.map((r) => ({ raw: r.priceToday, display: formatINR(r.priceToday) })),
    },
    {
      key: "price-fwd", label: t("row.price.forecast"), kind: "money",
      values: recs.map((r) => ({
        raw: r.priceAtHarvest, display: formatINR(r.priceAtHarvest),
        tone: r.priceAtHarvest > r.priceToday ? GREEN : r.priceAtHarvest < r.priceToday ? RED : undefined,
      })),
    },
    {
      key: "soil-match", label: t("row.soil.match"), kind: "pct",
      values: recs.map((r) => ({ raw: r.soilMatchPct, display: `${r.soilMatchPct}%` })),
    },
    {
      key: "weather-match", label: t("row.weather.match"), kind: "pct",
      values: recs.map((r) => ({ raw: r.weatherMatchPct, display: `${r.weatherMatchPct}%` })),
    },
    {
      key: "demand", label: t("row.demand"), kind: "label",
      values: recs.map((r) => ({
        raw: r.demand === "rising" ? 2 : r.demand === "stable" ? 1 : 0,
        display: r.demand === "rising" ? `↑ ${t("demand.rising")}` : r.demand === "falling" ? `↓ ${t("demand.falling")}` : `→ ${t("demand.stable")}`,
        tone: r.demand === "rising" ? GREEN : r.demand === "falling" ? RED : AMBER,
      })),
    },
    {
      key: "days", label: t("row.days"), kind: "qty",
      lowerIsBetter: true,
      values: recs.map((r) => ({ raw: r.daysToHarvest, display: `${r.daysToHarvest}` })),
    },
    {
      key: "conf", label: t("row.confidence"), kind: "pct",
      values: recs.map((r) => ({ raw: Math.round(r.confidence * 100), display: `${Math.round(r.confidence * 100)}%` })),
    },
  ];

  return (
    <section style={{ marginBottom: "2rem" }}>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: TEXT, letterSpacing: "-0.02em", marginBottom: 4 }}>
        🆚 {t("compare.title")}
      </h2>
      <p style={{ fontSize: 13, color: TEXT_DIM, marginBottom: 14 }}>{t("compare.sub")}</p>

      <div style={{
        background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14,
        overflowX: "auto", WebkitOverflowScrolling: "touch",
      }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ ...thSt, position: "sticky", left: 0, background: CARD, zIndex: 2, textAlign: "left" }}>
                {t("compare.metric")}
              </th>
              {recs.map((r, i) => (
                <th key={r.crop.id} style={{ ...thSt, textAlign: "center", minWidth: 140 }}>
                  <div style={{ fontSize: "1.4rem", marginBottom: 2 }}>{r.crop.emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: TEXT }}>
                    {cropName(r.crop, locale)}
                  </div>
                  {i === 0 && (
                    <span style={{
                      display: "inline-block", marginTop: 4, padding: "1px 8px", borderRadius: 999,
                      fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
                      background: "rgba(34,197,94,0.18)", color: GREEN,
                      border: `1px solid rgba(34,197,94,0.4)`,
                    }}>★ TOP</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              // Find the best value in the row.
              let bestIdx = 0;
              row.values.forEach((v, i) => {
                const isBetter = row.lowerIsBetter ? v.raw < row.values[bestIdx].raw : v.raw > row.values[bestIdx].raw;
                if (isBetter) bestIdx = i;
              });
              return (
                <tr key={row.key} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td style={{ ...tdSt, position: "sticky", left: 0, background: CARD, zIndex: 1, fontWeight: 700, color: TEXT_DIM, fontSize: 12 }}>
                    {row.label}
                  </td>
                  {row.values.map((v, i) => {
                    const isBest = i === bestIdx;
                    const color = v.tone ?? (isBest ? GREEN : TEXT);
                    return (
                      <td key={i} style={{
                        ...tdSt, textAlign: "center",
                        background: isBest && row.kind !== "label" ? "rgba(34,197,94,0.06)" : "transparent",
                        color, fontWeight: isBest ? 800 : 600,
                      }}>
                        {v.display}{isBest && row.kind === "best" ? " 🏆" : ""}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const thSt: React.CSSProperties = {
  padding: "0.85rem 0.9rem",
  fontSize: 12, fontWeight: 700, color: MUTED,
  letterSpacing: "0.04em", textTransform: "uppercase",
  borderBottom: `1px solid ${BORDER}`,
};
const tdSt: React.CSSProperties = {
  padding: "0.7rem 0.9rem",
  fontSize: 13, color: TEXT, whiteSpace: "nowrap",
};

// ─────────────────────────────────────────────────────────────────────────────
// Factor table — the *why* behind every yield number.
// ─────────────────────────────────────────────────────────────────────────────
const FactorTable: React.FC<{ recs: Recommendation[] }> = ({ recs }) => {
  const { t, locale } = useI18n();

  const factorKeys: Array<{ k: keyof YieldFactors; label: string }> = [
    { k: "soilType",    label: t("factor.soilType") },
    { k: "nutrients",   label: t("factor.nutrients") },
    { k: "ph",          label: t("factor.ph") },
    { k: "rainfall",    label: t("factor.rainfall") },
    { k: "temperature", label: t("factor.temperature") },
    { k: "mode",        label: t("factor.mode") },
  ];

  return (
    <section style={{ marginBottom: "2rem" }}>
      <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: TEXT, letterSpacing: "-0.02em", marginBottom: 4 }}>
        🔬 {t("compare.factor.title")}
      </h2>
      <p style={{ fontSize: 13, color: TEXT_DIM, marginBottom: 14 }}>{t("compare.factor.sub")}</p>

      <div style={{
        background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14,
        overflowX: "auto", WebkitOverflowScrolling: "touch",
      }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ ...thSt, position: "sticky", left: 0, background: CARD, zIndex: 2, textAlign: "left" }}>
                {t("compare.metric")}
              </th>
              {recs.map((r) => (
                <th key={r.crop.id} style={{ ...thSt, textAlign: "center", minWidth: 110 }}>
                  <span style={{ fontSize: "1rem", marginRight: 4 }}>{r.crop.emoji}</span>
                  <span style={{ fontSize: 12 }}>{cropName(r.crop, locale)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {factorKeys.map(({ k, label }) => (
              <tr key={k} style={{ borderTop: `1px solid ${BORDER}` }}>
                <td style={{ ...tdSt, position: "sticky", left: 0, background: CARD, zIndex: 1, fontWeight: 700, color: TEXT_DIM, fontSize: 12 }}>
                  {label}
                </td>
                {recs.map((r) => {
                  const v = k === "mode" ? r.chemical.factors[k] : r.chemical.factors[k];
                  const color = v >= 1.0 ? GREEN : v >= 0.92 ? AMBER : RED;
                  return (
                    <td key={r.crop.id} style={{ ...tdSt, textAlign: "center" }}>
                      <FactorBar value={v} color={color} />
                      <div style={{ fontSize: 11, color, fontWeight: 700, marginTop: 2 }}>
                        ×{v.toFixed(2)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const FactorBar: React.FC<{ value: number; color: string }> = ({ value, color }) => {
  // Map 0.5..1.2 to 0..100% width.
  const pct = Math.max(0, Math.min(100, ((value - 0.5) / 0.7) * 100));
  return (
    <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden", width: 80, margin: "0 auto" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.3s" }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Why cards — short narrative reasons for each top crop.
// ─────────────────────────────────────────────────────────────────────────────
const WhyCards: React.FC<{ recs: Recommendation[] }> = ({ recs }) => {
  const { t, locale } = useI18n();
  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: TEXT, marginBottom: 12, letterSpacing: "-0.02em" }}>
        💡 {t("advisor.why")}
      </h2>
      <div style={{ display: "grid", gap: "0.7rem", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {recs.slice(0, 3).map((r) => {
          const notes = cropNotes(r.crop, locale);
          return (
            <article key={r.crop.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "1rem 1.1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: "1.4rem" }}>{r.crop.emoji}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>{cropName(r.crop, locale)}</span>
              </div>
              <ul style={{ margin: 0, padding: "0 0 0 1.1rem", fontSize: 12.5, color: TEXT_DIM, lineHeight: 1.7 }}>
                {r.reasons.map((reason) => <li key={reason}>{reasonLabel(reason, t)}</li>)}
                {notes.slice(0, 2).map((n, i) => <li key={`n-${i}`} style={{ color: MUTED }}>{n}</li>)}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const EmptyState: React.FC = () => {
  const { t } = useI18n();
  return (
    <div style={{ background: CARD, border: `1px dashed ${BORDER}`, borderRadius: 16, padding: "2.5rem 1.5rem", textAlign: "center", color: MUTED }}>
      <div style={{ fontSize: "2rem", marginBottom: 8 }}>📍</div>
      <div>{t("advisor.use.location")}</div>
    </div>
  );
};

const Loading: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "2.5rem 1.5rem", textAlign: "center", color: MUTED }}>
    <div style={{ fontSize: "2rem", marginBottom: 8 }}>⌛</div>
    <div>{text}</div>
  </div>
);

const pillBtn = (active: boolean): React.CSSProperties => ({
  padding: "0.5rem 1.05rem", borderRadius: 999,
  background: active ? "rgba(34,197,94,0.15)" : CARD_HI,
  border: `1px solid ${active ? GREEN : BORDER}`,
  color: active ? GREEN : TEXT,
  fontSize: 13, fontWeight: active ? 700 : 600,
  cursor: "pointer", fontFamily: "inherit",
  transition: "background 0.15s, border-color 0.15s",
});

const speakBtn = (color: string): React.CSSProperties => ({
  padding: "0.55rem 1rem", borderRadius: 10,
  background: color + "18", color,
  border: `1px solid ${color}40`,
  fontSize: 13, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
});

export default DecisionEngine;
