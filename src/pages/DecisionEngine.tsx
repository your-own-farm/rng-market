// ── Crop Decision Engine ─────────────────────────────────────────────────────
// The public, no-login flagship flow:
//   Where → Acres → Soil → Season → Recommendations
// Inputs are persisted to localStorage so the farmer doesn't re-enter them on
// every visit. Outputs combine live mandi prices, Open-Meteo weather and the
// offline crop knowledge base.

import React from "react";
import { useI18n } from "../i18n";
import { STATES, findState, findDistrict, District, StateGeo } from "../geo";
import { SoilType, Season, currentSeason, cropName, cropNotes } from "../crops";
import { CropPriceVM } from "../types";
import { useWeather } from "../useWeather";
import { useSoil } from "../useSoil";
import { getCurrentLocation } from "../useGeocode";
import { recommend, Recommendation, reasonLabel } from "../recommender";
import { speak, stop, isSupported as ttsSupported } from "../tts";
import {
  Dropdown, DropdownOption, SectionTitle, Stat, Pill,
  formatINR, CARD, CARD_HI, BORDER, GREEN, RED, AMBER, BLUE, VIOLET, MUTED, TEXT, TEXT_DIM,
} from "../ui";

const STORAGE_KEY = "kinsar.advisor.inputs";

interface AdvisorInputs {
  state: string;
  district: string;
  acres: number;
  soil: SoilType | "auto";
  season: Season | "auto";
  mode: "organic" | "urea";
}

const DEFAULTS: AdvisorInputs = {
  state: "",
  district: "",
  acres: 1,
  soil: "auto",
  season: "auto",
  mode: "urea",
};

function loadInputs(): AdvisorInputs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch { return DEFAULTS; }
}

function saveInputs(i: AdvisorInputs) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(i)); } catch {}
}

// ──────────────────────────────────────────────────────────────────────────────

interface Props { prices: CropPriceVM[] }

const DecisionEngine: React.FC<Props> = ({ prices }) => {
  const { t, locale } = useI18n();
  const [inputs, setInputsState] = React.useState<AdvisorInputs>(() => loadInputs());
  const [locating, setLocating] = React.useState(false);
  const [locError, setLocError] = React.useState<string | null>(null);
  const [showResults, setShowResults] = React.useState<boolean>(() => !!loadInputs().state);
  const [speaking, setSpeaking] = React.useState(false);

  const setInputs = React.useCallback((patch: Partial<AdvisorInputs>) => {
    setInputsState((prev) => {
      const next = { ...prev, ...patch };
      saveInputs(next);
      return next;
    });
  }, []);

  // Resolve the chosen district -> lat/lng for downstream APIs.
  const stateObj: StateGeo | undefined = React.useMemo(
    () => (inputs.state ? findState(inputs.state) : undefined),
    [inputs.state]
  );
  const districtObj: District | undefined = React.useMemo(
    () => (inputs.state && inputs.district ? findDistrict(inputs.state, inputs.district) : undefined),
    [inputs.state, inputs.district]
  );

  const lat = districtObj?.lat ?? null;
  const lng = districtObj?.lng ?? null;

  // Live signals.
  const weather = useWeather(lat, lng);
  const soilApi = useSoil(lat, lng, districtObj?.soil ?? "loamy");

  // Resolve effective soil — explicit choice > SoilGrids > district default.
  const effectiveSoil: SoilType | null = React.useMemo(() => {
    if (inputs.soil !== "auto") return inputs.soil;
    if (soilApi.data) return soilApi.data.classified;
    if (districtObj) return districtObj.soil;
    return null;
  }, [inputs.soil, soilApi.data, districtObj]);

  const effectiveSeason: Season = inputs.season === "auto" ? currentSeason() : inputs.season;

  const recs: Recommendation[] = React.useMemo(() => {
    if (!showResults) return [];
    return recommend({
      state: inputs.state || null,
      district: inputs.district || null,
      acres: inputs.acres,
      soil: effectiveSoil,
      season: effectiveSeason,
      mode: inputs.mode,
      prices,
      weather: weather.data,
    });
  }, [showResults, inputs, effectiveSoil, effectiveSeason, prices, weather.data]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const stateOptions: DropdownOption[] = React.useMemo(
    () => STATES.map((s) => ({ value: s.name, label: s.name })),
    []
  );
  const districtOptions: DropdownOption[] = React.useMemo(
    () => (stateObj ? stateObj.districts.map((d) => ({ value: d.name, label: d.name })) : []),
    [stateObj]
  );

  const soilOptions: DropdownOption[] = [
    { value: "auto",     label: t("advisor.soil.auto") },
    { value: "alluvial", label: t("soil.alluvial") },
    { value: "black",    label: t("soil.black") },
    { value: "red",      label: t("soil.red") },
    { value: "laterite", label: t("soil.laterite") },
    { value: "sandy",    label: t("soil.sandy") },
    { value: "loamy",    label: t("soil.loamy") },
    { value: "clay",     label: t("soil.clay") },
  ];

  const seasonOptions: DropdownOption[] = [
    { value: "auto",   label: t("season.auto") },
    { value: "kharif", label: t("season.kharif") },
    { value: "rabi",   label: t("season.rabi") },
    { value: "zaid",   label: t("season.zaid") },
  ];

  const modeOptions: DropdownOption[] = [
    { value: "urea",    label: t("calc.mode.urea") },
    { value: "organic", label: t("calc.mode.organic") },
  ];

  // ── "Use my location" handler ──────────────────────────────────────────────
  const useMyLocation = async () => {
    setLocating(true);
    setLocError(null);
    try {
      const g = await getCurrentLocation();
      if (g.state && g.district) {
        setInputs({ state: g.state.name, district: g.district.name });
      } else {
        setLocError("Could not detect your district. Pick it manually.");
      }
    } catch (err: any) {
      setLocError(err?.message ?? "Location access denied.");
    } finally {
      setLocating(false);
    }
  };

  // ── Speak the top recommendation aloud ─────────────────────────────────────
  const readAloud = () => {
    if (recs.length === 0) return;
    const top = recs[0];
    const txt = [
      t("advisor.results.title"),
      cropName(top.crop, locale),
      `${t("card.profit")} ${formatINR(top.netProfitPerAcre)} ${t("card.per.acre")}.`,
      `${t("card.yield")} ${top.expectedYield} ${t("card.unit.qtl")}.`,
      `${t("card.price")} ${formatINR(top.expectedPrice)} ${t("card.unit.qtl.short")}.`,
    ].join(". ");
    const ok = speak(txt, locale);
    setSpeaking(ok);
    if (ok) {
      const id = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          setSpeaking(false);
          clearInterval(id);
        }
      }, 500);
    }
  };

  const stopReading = () => { stop(); setSpeaking(false); };

  const ready = inputs.state && inputs.district && inputs.acres > 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(99,102,241,0.06))",
        border: `1px solid ${BORDER}`, borderRadius: 20,
        padding: "2rem 1.6rem", marginBottom: "1.5rem",
      }}>
        <div style={{ fontSize: "0.78rem", fontWeight: 700, color: GREEN, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
          🌾 {t("brand.title")}
        </div>
        <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", fontWeight: 900, color: TEXT, lineHeight: 1.15, letterSpacing: "-0.03em", marginBottom: 10 }}>
          {t("advisor.headline")}
        </h1>
        <p style={{ fontSize: "1rem", color: TEXT_DIM, lineHeight: 1.6, maxWidth: 640 }}>
          {t("advisor.sub")}
        </p>
      </div>

      {/* Input panel */}
      <div style={{
        background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16,
        padding: "1.4rem", marginBottom: "1.5rem",
      }}>
        {/* Step 1: Where */}
        <Step number={1} label={t("advisor.step.where")}>
          <div style={{ display: "grid", gap: "0.7rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <Dropdown
              icon="📍"
              placeholder={t("advisor.state")}
              value={inputs.state}
              options={stateOptions}
              onChange={(v) => setInputs({ state: v, district: "" })}
            />
            <Dropdown
              icon="🏘️"
              placeholder={t("advisor.district")}
              value={inputs.district}
              options={districtOptions}
              onChange={(v) => setInputs({ district: v })}
            />
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              style={{
                padding: "0.6rem 1rem", borderRadius: 10,
                background: locating ? "rgba(34,197,94,0.08)" : "rgba(34,197,94,0.15)",
                border: `1px solid rgba(34,197,94,0.35)`,
                color: GREEN, fontSize: 13, fontWeight: 700,
                cursor: locating ? "wait" : "pointer", whiteSpace: "nowrap",
                fontFamily: "inherit",
              }}
            >
              {locating ? `⌛ ${t("advisor.locating")}` : `📡 ${t("advisor.use.location")}`}
            </button>
          </div>
          {locError && <p style={{ fontSize: 12, color: RED, marginTop: 8 }}>{locError}</p>}
        </Step>

        {/* Step 2: Size */}
        <Step number={2} label={t("advisor.step.size")}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", flexWrap: "wrap" }}>
            <input
              type="number"
              min={0.25} step={0.25}
              value={inputs.acres}
              onChange={(e) => setInputs({ acres: Math.max(0.25, Number(e.target.value) || 0) })}
              style={{
                background: CARD_HI, border: `1px solid ${BORDER}`,
                borderRadius: 10, color: TEXT, padding: "0.65rem 1rem",
                fontSize: 16, width: 140, outline: "none", fontFamily: "inherit",
              }}
            />
            <span style={{ fontSize: 13, color: MUTED }}>{t("advisor.acres")}</span>
            <span style={{ fontSize: 12, color: MUTED, marginLeft: "auto" }}>{t("advisor.acres.help")}</span>
          </div>
        </Step>

        {/* Step 3: Soil */}
        <Step number={3} label={t("advisor.step.soil")}>
          <div style={{ display: "grid", gap: "0.7rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <Dropdown
              icon="🪨"
              value={inputs.soil}
              options={soilOptions}
              onChange={(v) => setInputs({ soil: v as AdvisorInputs["soil"] })}
            />
            {/* Live soil readout */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.6rem 0.9rem", borderRadius: 10, background: CARD_HI, border: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{t("ui.detected")}:</span>
              <span style={{ fontSize: 13, color: TEXT, fontWeight: 700 }}>
                {effectiveSoil ? t(`soil.${effectiveSoil}`) : "—"}
              </span>
              {soilApi.data && (
                <Pill color={soilApi.data.source === "soilgrids" ? GREEN : MUTED}>
                  {soilApi.data.source === "soilgrids" ? "SoilGrids" : t("ui.offline")}
                </Pill>
              )}
            </div>
          </div>
        </Step>

        {/* Step 4: Season + mode */}
        <Step number={4} label={t("advisor.step.season")}>
          <div style={{ display: "grid", gap: "0.7rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <Dropdown icon="📅" value={inputs.season} options={seasonOptions} onChange={(v) => setInputs({ season: v as AdvisorInputs["season"] })} />
            <Dropdown icon="🧪" value={inputs.mode} options={modeOptions} onChange={(v) => setInputs({ mode: v as AdvisorInputs["mode"] })} />
          </div>
        </Step>

        <div style={{ marginTop: "1rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setShowResults(true)}
            disabled={!ready}
            style={{
              padding: "0.85rem 1.6rem", borderRadius: 12,
              background: ready ? GREEN : "rgba(255,255,255,0.05)",
              border: `1px solid ${ready ? GREEN : BORDER}`,
              color: ready ? "#0b1120" : MUTED,
              fontSize: 14, fontWeight: 800, letterSpacing: "0.02em",
              cursor: ready ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              transition: "background 0.15s",
            }}
          >
            {t("advisor.see.results")} →
          </button>
          {weather.loading && (
            <span style={{ fontSize: 12, color: MUTED, alignSelf: "center" }}>⏳ {t("weather.loading")}</span>
          )}
        </div>
      </div>

      {/* Results */}
      {showResults && (
        <div>
          <SectionTitle title={t("advisor.results.title")} sub={t("advisor.results.sub")} />

          {/* Speak controls */}
          {ttsSupported() && recs.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {!speaking ? (
                <button onClick={readAloud} style={speakBtn(GREEN)}>{t("advisor.read.aloud")}</button>
              ) : (
                <button onClick={stopReading} style={speakBtn(AMBER)}>{t("advisor.stop.reading")}</button>
              )}
            </div>
          )}

          {recs.length === 0 ? (
            <div style={{
              padding: "2.5rem 1.5rem", background: CARD, border: `1px dashed ${BORDER}`,
              borderRadius: 16, color: MUTED, textAlign: "center",
            }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>🌱</div>
              {t("advisor.no.results")}
            </div>
          ) : (
            <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {recs.map((r, idx) => (
                <RecCard key={r.crop.id} r={r} acres={inputs.acres} rank={idx + 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const Step: React.FC<{ number: number; label: string; children: React.ReactNode }> = ({ number, label, children }) => (
  <div style={{ marginBottom: "1.3rem" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <span style={{
        width: 24, height: 24, borderRadius: "50%",
        background: "rgba(34,197,94,0.15)", color: GREEN,
        fontSize: 12, fontWeight: 800,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        border: `1px solid rgba(34,197,94,0.4)`,
      }}>{number}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, letterSpacing: "0.02em" }}>{label}</span>
    </div>
    {children}
  </div>
);

const RecCard: React.FC<{ r: Recommendation; acres: number; rank: number }> = ({ r, acres, rank }) => {
  const { t, locale } = useI18n();
  const [open, setOpen] = React.useState(false);

  const profitTotal = r.netProfitPerAcre * acres;
  const profitTone = r.netProfitPerAcre > 30000 ? GREEN : r.netProfitPerAcre > 10000 ? AMBER : RED;
  const riskColor  = r.weatherRisk === "low" ? GREEN : r.weatherRisk === "medium" ? AMBER : RED;
  const demandColor = r.demand === "rising" ? GREEN : r.demand === "falling" ? RED : AMBER;
  const demandLabel = r.demand === "rising" ? t("demand.rising") : r.demand === "falling" ? t("demand.falling") : t("demand.stable");
  const riskLabel   = r.weatherRisk === "low" ? t("risk.low") : r.weatherRisk === "medium" ? t("risk.medium") : t("risk.high");

  const notes = cropNotes(r.crop, locale);

  return (
    <article style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16,
      padding: "1.3rem", display: "flex", flexDirection: "column", gap: "0.7rem",
      position: "relative", overflow: "hidden",
    }}>
      {rank === 1 && (
        <div style={{
          position: "absolute", top: 12, right: 12,
          padding: "2px 8px", borderRadius: 999,
          background: "rgba(34,197,94,0.18)", color: GREEN,
          fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
          border: `1px solid rgba(34,197,94,0.4)`,
        }}>★ TOP</div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: "2.2rem" }}>{r.crop.emoji}</span>
        <div>
          <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: TEXT, lineHeight: 1.1 }}>
            {cropName(r.crop, locale)}
          </h3>
          <span style={{ fontSize: 12, color: MUTED }}>{r.daysToHarvest} {t("card.days").toLowerCase()}</span>
        </div>
      </div>

      {/* Profit headline */}
      <div style={{
        background: `${profitTone}12`, border: `1px solid ${profitTone}30`,
        borderRadius: 12, padding: "0.85rem 1rem",
      }}>
        <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
          {t("card.profit")} ({t("card.per.acre")})
        </div>
        <div style={{ fontSize: "1.55rem", fontWeight: 800, color: profitTone, letterSpacing: "-0.02em" }}>
          {formatINR(r.netProfitPerAcre)}
        </div>
        {acres > 1 && (
          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
            × {acres} {t("advisor.acres")} = {formatINR(profitTotal)}
          </div>
        )}
      </div>

      {/* Stats */}
      <div>
        <Stat label={t("card.yield")}   value={`${r.expectedYield} ${t("card.unit.qtl")}`} />
        <Stat label={t("card.price")}   value={`${formatINR(r.expectedPrice)} ${t("card.unit.qtl.short")}`} />
        <Stat label={t("card.revenue")} value={formatINR(r.grossRevenuePerAcre)} tone="good" />
        <Stat label={t("card.cost")}    value={formatINR(r.inputCostPerAcre)}     tone="bad" />
      </div>

      {/* Badges */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Pill color={riskColor}>⚠ {riskLabel}</Pill>
        <Pill color={demandColor}>📈 {demandLabel}</Pill>
        <Pill color={BLUE}>{Math.round(r.confidence * 100)}% {t("advisor.confidence")}</Pill>
      </div>

      {/* Why */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "transparent", border: `1px solid ${BORDER}`,
          color: VIOLET, fontSize: 12, fontWeight: 700,
          padding: "0.5rem 0.8rem", borderRadius: 8,
          cursor: "pointer", textAlign: "left", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <span>💡 {t("advisor.why")}</span>
        <span style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </button>
      {open && (
        <ul style={{ margin: 0, padding: "0 0 0 1.2rem", color: TEXT_DIM, fontSize: 13, lineHeight: 1.7 }}>
          {r.reasons.map((reason) => (
            <li key={reason}>{reasonLabel(reason, t)}</li>
          ))}
          {notes.map((n, i) => (
            <li key={`note-${i}`} style={{ color: MUTED }}>{n}</li>
          ))}
        </ul>
      )}
    </article>
  );
};

const speakBtn = (color: string): React.CSSProperties => ({
  padding: "0.55rem 1rem", borderRadius: 10,
  background: color + "18", color,
  border: `1px solid ${color}40`,
  fontSize: 13, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
});

export default DecisionEngine;
