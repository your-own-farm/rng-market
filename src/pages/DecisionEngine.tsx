// ── Crop Decision Engine — farmer-first UX ───────────────────────────────────
// Design principle: a farmer with limited literacy should be able to skim this
// page and walk away with a clear answer to "what crop will earn me the most?"
//
// To that end the page is built around big visuals instead of percentages and
// tables:
//
//   1. Animated hero (rain, sun, growing plant, rising coins).
//   2. Two-input panel (📡 location, acres pills).
//   3. "What we detected" cards with friendly icons.
//   4. Winner banner with an animated ₹ counter and sparkles.
//   5. Profit-ranking race chart (longest bar = best crop).
//   6. Tap-to-expand crop detail card with mood faces (😊 🙂 😐 😟)
//      for soil / weather / demand, plus organic-vs-chemical bars.
//   7. Optional full comparison table for users who want raw numbers.

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
import {
  AnimatedINR, MoodFace, MoodTone, moodFromScore,
  RaceBar, Sparkles, GrowingPlant, HeroIllustration,
  RankMedal, StarRating, DemandArrow, FadeUp,
} from "../animations";

const STORAGE_KEY = "kinsar.advisor.inputs";

interface AdvisorState { state: string; district: string; acres: number }
const DEFAULTS: AdvisorState = { state: "", district: "", acres: 1 };

const load = (): AdvisorState => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; }
  catch { return DEFAULTS; }
};
const save = (s: AdvisorState) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} };

const ACRE_PRESETS = [1, 2, 5, 10];

interface Props { prices: CropPriceVM[] }

const DecisionEngine: React.FC<Props> = ({ prices }) => {
  const { t, locale } = useI18n();
  const [s, setS]                   = React.useState<AdvisorState>(() => load());
  const [locating, setLocating]     = React.useState(false);
  const [locError, setLocError]     = React.useState<string | null>(null);
  const [showManual, setShowManual] = React.useState<boolean>(() => !!load().state);
  const [speaking, setSpeaking]     = React.useState(false);
  const [customAcres, setCustomAcres] = React.useState<boolean>(() => !ACRE_PRESETS.includes(load().acres));
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [showFullTable, setShowFullTable] = React.useState(false);

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
  const season  = currentSeason();

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

  const top = recs[0];
  const maxNet = top ? Math.max(1, top.bestNet) : 1;

  // Auto-expand the #1 the first time results land.
  React.useEffect(() => {
    if (top && expandedId === null) setExpandedId(top.crop.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top?.crop.id]);

  // ── Handlers ──────────────────────────────────────────────────────────────
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

  const readAloud = () => {
    if (!top) return;
    const txt = [
      cropName(top.crop, locale),
      `${t("label.profit.simple")} ${formatINR(top.bestNet)} ${t("card.per.acre")}.`,
      `${t("label.harvest.in")} ${top.daysToHarvest} ${t("label.days")}.`,
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
      {/* ── Hero ─── */}
      <FadeUp>
        <div style={{
          background: "linear-gradient(135deg, rgba(34,197,94,0.16) 0%, rgba(99,102,241,0.08) 60%, rgba(245,158,11,0.10) 100%)",
          border: `1px solid ${BORDER}`,
          borderRadius: 24,
          padding: "1.7rem 1.6rem",
          marginBottom: "1.4rem",
          display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ flex: "1 1 280px", minWidth: 240 }}>
            <div style={{ fontSize: "0.78rem", fontWeight: 800, color: GREEN, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
              🌾 {t("brand.title")}
            </div>
            <h1 style={{
              fontSize: "clamp(1.55rem, 4.2vw, 2.4rem)",
              fontWeight: 900, color: TEXT,
              lineHeight: 1.13, letterSpacing: "-0.03em", marginBottom: 10,
            }}>
              {t("advisor.auto.headline")}
            </h1>
            <p style={{ fontSize: "1rem", color: TEXT_DIM, lineHeight: 1.6 }}>
              {t("advisor.auto.sub")}
            </p>
          </div>
          <HeroIllustration />
        </div>
      </FadeUp>

      {/* ── Input panel ─── */}
      <FadeUp delay={80}>
        <div style={inputCardSt}>
          <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.7rem" }}>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              style={{
                padding: "0.95rem 1.5rem", borderRadius: 14,
                background: locating ? "rgba(34,197,94,0.10)" : `linear-gradient(180deg, ${GREEN}, #16a34a)`,
                border: `1px solid ${GREEN}`,
                color: locating ? GREEN : "#0b1120",
                fontSize: 15, fontWeight: 800, letterSpacing: "0.02em",
                cursor: locating ? "wait" : "pointer", fontFamily: "inherit",
                display: "inline-flex", alignItems: "center", gap: 8,
                boxShadow: locating ? "none" : "0 8px 24px rgba(34,197,94,0.28)",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
              onMouseUp={(e)   => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(e)=> (e.currentTarget.style.transform = "scale(1)")}
            >
              <span className={locating ? "ki-anim-pulse" : ""} style={{ fontSize: 18 }}>📡</span>
              {locating ? t("advisor.locating") : t("advisor.auto.detect")}
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
            >{t("advisor.auto.manual")}</button>
          </div>
          {locError && <p style={{ fontSize: 12, color: AMBER, margin: "0 0 8px" }}>⚠ {locError}</p>}

          {showManual && (
            <div style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: "0.9rem" }}>
              <Dropdown icon="📍" placeholder={t("advisor.state")}    value={s.state}    options={stateOptions}    onChange={(v) => update({ state: v, district: "" })} />
              <Dropdown icon="🏘️" placeholder={t("advisor.district")} value={s.district} options={districtOptions} onChange={(v) => update({ district: v })} />
            </div>
          )}

          <div>
            <label style={fieldLabelSt}>{t("advisor.auto.size")}</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ACRE_PRESETS.map((n) => {
                const active = !customAcres && s.acres === n;
                return (
                  <button key={n} type="button"
                    onClick={() => { update({ acres: n }); setCustomAcres(false); }}
                    style={pillBtn(active)}>
                    {n} {t("advisor.acres")}
                  </button>
                );
              })}
              <button type="button"
                onClick={() => setCustomAcres(true)}
                style={pillBtn(customAcres)}>{t("advisor.auto.acres.other")}…</button>
              {customAcres && (
                <input
                  type="number"
                  min={0.25} step={0.25}
                  value={s.acres}
                  onChange={(e) => update({ acres: Math.max(0.25, Number(e.target.value) || 0) })}
                  autoFocus
                  style={customAcreInputSt}
                />
              )}
            </div>
          </div>
        </div>
      </FadeUp>

      {/* ── Detected cards ─── */}
      {districtObj && (
        <FadeUp delay={150}>
          <DetectedRow state={s.state} district={s.district} soil={soilApi.data} weather={weather.data} loading={isComputing} />
        </FadeUp>
      )}

      {/* ── Loading / Empty / Results ─── */}
      {!districtObj ? (
        <EmptyState />
      ) : isComputing && recs.length === 0 ? (
        <GrowingPlant text={t("advisor.auto.computing")} />
      ) : (
        <>
          {top && (
            <FadeUp delay={220}>
              <WinnerBanner top={top} acres={s.acres} />
            </FadeUp>
          )}

          {/* TTS + Show-full-table toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {ttsSupported() && top && (
              !speaking
                ? <button onClick={readAloud} style={speakBtn(GREEN)}>{t("advisor.read.aloud")}</button>
                : <button onClick={stop}       style={speakBtn(AMBER)}>{t("advisor.stop.reading")}</button>
            )}
            {recs.length > 0 && (
              <button
                onClick={() => setShowFullTable((v) => !v)}
                style={speakBtn(VIOLET)}
              >
                {showFullTable ? `📊 ${t("label.hide.all")}` : `📊 ${t("label.show.all")}`}
              </button>
            )}
          </div>

          {recs.length > 0 && (
            <ProfitRanking
              recs={recs}
              maxNet={maxNet}
              acres={s.acres}
              expandedId={expandedId}
              onExpand={(id) => setExpandedId((cur) => cur === id ? null : id)}
            />
          )}

          {showFullTable && recs.length > 0 && (
            <FadeUp>
              <FullComparison recs={recs} acres={s.acres} />
            </FadeUp>
          )}
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DetectedRow — coloured tiles that prove the engine has auto-filled itself.
// ─────────────────────────────────────────────────────────────────────────────
const DetectedRow: React.FC<{
  state: string; district: string;
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
      <div style={{ fontSize: 11, color: MUTED, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
        ✓ {t("advisor.auto.detected")}
      </div>
      <div style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <DetectedTile
          icon={<span className="ki-anim-bounce" style={{ fontSize: 24, display: "inline-block" }}>📍</span>}
          label={`${district}`}
          sub={state}
          tone={GREEN}
        />
        <DetectedTile
          icon={<span style={{ fontSize: 24 }}>🪨</span>}
          label={soil ? t(`soil.${soil.classified}`) : (loading ? "…" : "—")}
          sub={soil ? `${t("soil.ph.label")} ${soil.ph?.toFixed(1) ?? "—"} · N ${t(`soil.fertility.${soil.fertility.n}`)}` : ""}
          tone={AMBER}
          source={soil?.source === "soilgrids" ? "SoilGrids" : soil ? t("ui.offline") : undefined}
        />
        <DetectedTile
          icon={
            weather
              ? <span className="ki-anim-spin-slow" style={{ fontSize: 24, display: "inline-block" }}>☀️</span>
              : <span style={{ fontSize: 24 }}>⏳</span>
          }
          label={weather ? `${weather.avgTempMax.toFixed(0)}° / ${weather.avgTempMin.toFixed(0)}°C` : (loading ? "…" : "—")}
          sub={weather ? `💧 ${weather.totalRain7d.toFixed(0)} mm` : ""}
          tone={BLUE}
          source={weather?.source === "open-meteo" ? "Open-Meteo" : weather ? t("ui.offline") : undefined}
        />
        <DetectedTile
          icon={<span style={{ fontSize: 24 }}>📅</span>}
          label={t("season." + currentSeason())}
          sub={t("season.auto")}
          tone={VIOLET}
        />
      </div>
    </div>
  );
};

const DetectedTile: React.FC<{ icon: React.ReactNode; label: string; sub?: string; tone: string; source?: string }> = ({ icon, label, sub, tone, source }) => (
  <div style={{
    background: `linear-gradient(135deg, ${tone}10, transparent)`,
    border: `1px solid ${tone}30`,
    borderRadius: 14, padding: "0.8rem 1rem",
    display: "flex", alignItems: "center", gap: 12,
  }}>
    <div style={{
      width: 44, height: 44, borderRadius: 12,
      background: tone + "1a", border: `1px solid ${tone}40`,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>{icon}</div>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: TEXT, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{sub}</div>}
      {source && <div style={{ marginTop: 5 }}><Pill color={source.startsWith("Soil") || source.startsWith("Open") ? GREEN : MUTED}>{source}</Pill></div>}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// WinnerBanner — animated headline.
// ─────────────────────────────────────────────────────────────────────────────
const WinnerBanner: React.FC<{ top: Recommendation; acres: number }> = ({ top, acres }) => {
  const { t, locale } = useI18n();
  const total = top.bestNet * acres;
  const isChem = top.bestMode === "chemical";
  return (
    <div style={{
      background: `radial-gradient(ellipse at 0% 0%, rgba(34,197,94,0.25), rgba(34,197,94,0.06) 60%), ${CARD}`,
      border: `1px solid ${GREEN}55`,
      borderRadius: 22,
      padding: "1.5rem 1.6rem",
      marginBottom: "1.3rem",
      position: "relative",
      overflow: "hidden",
      boxShadow: `0 18px 60px rgba(34,197,94,0.18)`,
    }}>
      <Sparkles count={8} />
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div className="ki-anim-bounce" style={{ fontSize: "3.5rem", lineHeight: 1, flexShrink: 0 }}>
          {top.crop.emoji}
        </div>
        <div style={{ flex: "1 1 220px", minWidth: 180 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <RankMedal rank={1} size={28} />
            <span style={{ fontSize: 11, color: GREEN, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {t("compare.winner")}
            </span>
          </div>
          <div style={{ fontSize: "1.7rem", fontWeight: 900, color: TEXT, letterSpacing: "-0.02em", lineHeight: 1.05 }}>
            {cropName(top.crop, locale)}
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6,
            padding: "3px 10px", borderRadius: 999,
            background: isChem ? "rgba(56,189,248,0.14)" : "rgba(34,197,94,0.14)",
            color: isChem ? BLUE : GREEN,
            border: `1px solid ${isChem ? BLUE : GREEN}40`,
            fontSize: 12, fontWeight: 700,
          }}>
            {isChem ? "⚗️" : "🌿"} {isChem ? t("mode.best.chemical") : t("mode.best.organic")}
          </div>
        </div>
        <div style={{ textAlign: "right", minWidth: 160 }}>
          <div style={{ fontSize: 11, color: MUTED, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {t("label.profit.total")}
          </div>
          <div style={{ fontSize: "2.1rem", fontWeight: 900, color: GREEN, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
            <AnimatedINR value={total} duration={1100} />
          </div>
          <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 2 }}>
            {formatINR(top.bestNet)} × {acres} {t("advisor.acres")}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
            ⏱ {t("label.harvest.in")} {top.daysToHarvest} {t("label.days")}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ProfitRanking — the heart of the new UX. Cards as bars; tap to expand.
// ─────────────────────────────────────────────────────────────────────────────
const ProfitRanking: React.FC<{
  recs: Recommendation[];
  maxNet: number;
  acres: number;
  expandedId: string | null;
  onExpand: (id: string) => void;
}> = ({ recs, maxNet, acres, expandedId, onExpand }) => {
  const { t, locale } = useI18n();
  return (
    <section style={{ marginBottom: "1.6rem" }}>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: TEXT, letterSpacing: "-0.02em", marginBottom: 4 }}>
        🏆 {t("ranking.title")}
      </h2>
      <p style={{ fontSize: 13, color: TEXT_DIM, marginBottom: 14 }}>{t("ranking.sub")}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
        {recs.map((r, i) => (
          <FadeUp key={r.crop.id} delay={i * 70}>
            <RankCard
              r={r}
              rank={i + 1}
              maxNet={maxNet}
              acres={acres}
              expanded={expandedId === r.crop.id}
              onToggle={() => onExpand(r.crop.id)}
            />
          </FadeUp>
        ))}
      </div>
    </section>
  );
};

const RankCard: React.FC<{
  r: Recommendation;
  rank: number;
  maxNet: number;
  acres: number;
  expanded: boolean;
  onToggle: () => void;
}> = ({ r, rank, maxNet, acres, expanded, onToggle }) => {
  const { t, locale } = useI18n();
  const isTop = rank === 1;
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      style={{
        background: isTop
          ? `linear-gradient(135deg, rgba(34,197,94,0.10), ${CARD})`
          : CARD,
        border: `1px solid ${isTop ? GREEN + "55" : BORDER}`,
        borderRadius: 18,
        padding: "1.1rem 1.2rem",
        cursor: "pointer",
        transition: "transform 0.18s, border-color 0.18s, background 0.18s",
        boxShadow: isTop ? `0 10px 40px rgba(34,197,94,0.12)` : "none",
        outline: "none",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{ flexShrink: 0 }}>
          <RankMedal rank={rank} size={36} />
        </div>
        <div className={isTop ? "ki-anim-bounce" : ""} style={{ fontSize: "2rem", lineHeight: 1, flexShrink: 0 }}>
          {r.crop.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: TEXT, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {cropName(r.crop, locale)}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
            ⏱ {r.daysToHarvest} {t("label.days")} · {r.bestMode === "chemical" ? "⚗️" : "🌿"} {r.bestMode === "chemical" ? t("mode.chemical") : t("mode.organic")}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "1.35rem", fontWeight: 900, color: GREEN, letterSpacing: "-0.02em", lineHeight: 1 }}>
            <AnimatedINR value={r.bestNet * acres} duration={900 + rank * 60} />
          </div>
          <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 700, marginTop: 2 }}>
            {acres} {t("advisor.acres")}
          </div>
        </div>
      </div>

      {/* Race bar */}
      <RaceBar value={r.bestNet} max={maxNet} color={isTop ? GREEN : rank === 2 ? "#84cc16" : rank === 3 ? AMBER : "#94a3b8"} delay={rank * 80} height={12} />

      {/* Quick chips row */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10,
        fontSize: 12, color: TEXT_DIM,
      }}>
        <ChipMood label={t("row.soil.match")}    score={r.soilMatchPct / 100} />
        <ChipMood label={t("row.weather.match")} score={r.weatherMatchPct / 100} />
        <DemandArrow direction={r.demand} label={
          r.demand === "rising" ? t("demand.rising") : r.demand === "falling" ? t("demand.falling") : t("demand.stable")
        } />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <StarRating score={r.confidence} />
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: VIOLET, fontWeight: 700 }}>
          {expanded ? "▴" : "▾"} {t("label.tap.expand")}
        </span>
      </div>

      {/* Expandable detail */}
      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${BORDER}` }}>
          <ExpandedDetail r={r} acres={acres} />
        </div>
      )}
    </article>
  );
};

const ChipMood: React.FC<{ label: string; score: number }> = ({ label, score }) => {
  const tone = moodFromScore(score);
  const color = tone === "happy" || tone === "ok" ? GREEN : tone === "meh" ? AMBER : RED;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 999,
      background: color + "14", color,
      fontSize: 12, fontWeight: 700, border: `1px solid ${color}30`,
    }}>
      <MoodFace score={score} size={14} /> {label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ExpandedDetail — visible inside a RankCard after the farmer taps it.
// ─────────────────────────────────────────────────────────────────────────────
const ExpandedDetail: React.FC<{ r: Recommendation; acres: number }> = ({ r, acres }) => {
  const { t, locale } = useI18n();
  const orgBest = r.bestMode === "organic";
  const maxNet = Math.max(r.chemical.net, r.organic.net, 1);
  const notes  = cropNotes(r.crop, locale);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {/* Big metric tiles */}
      <div style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <MetricTile label={t("row.price.now")}       value={formatINR(r.priceToday)}      tone={TEXT} />
        <MetricTile label={t("row.price.forecast")}  value={formatINR(r.priceAtHarvest)}  tone={r.priceAtHarvest > r.priceToday ? GREEN : r.priceAtHarvest < r.priceToday ? RED : TEXT} />
        <MetricTile label={t("row.yield.chemical")}  value={`${r.chemical.yieldQtl}`}     unit={t("card.unit.qtl")} tone={TEXT} />
        <MetricTile label={t("row.confidence")}      value="" custom={<StarRating score={r.confidence} size={18} />} tone={TEXT} />
      </div>

      {/* Organic vs Chemical comparison bars */}
      <div>
        <div style={{ fontSize: 12, color: MUTED, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
          🌿 ⚖️ ⚗️ {t("compare.title")}
        </div>
        <ModeBar
          icon="🌿"
          label={t("label.if.organic")}
          net={r.organic.net}
          maxNet={maxNet}
          isBest={orgBest}
          color={GREEN}
        />
        <div style={{ height: 8 }} />
        <ModeBar
          icon="⚗️"
          label={t("label.if.chemical")}
          net={r.chemical.net}
          maxNet={maxNet}
          isBest={!orgBest}
          color={BLUE}
        />
      </div>

      {/* Why bullets */}
      <div>
        <div style={{ fontSize: 12, color: MUTED, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
          💡 {t("advisor.why")}
        </div>
        <ul style={{ margin: 0, padding: "0 0 0 1.1rem", color: TEXT_DIM, fontSize: 13, lineHeight: 1.7 }}>
          {r.reasons.map((reason) => <li key={reason}>{reasonLabel(reason, t)}</li>)}
          {notes.slice(0, 2).map((n, i) => <li key={`n-${i}`} style={{ color: MUTED }}>{n}</li>)}
        </ul>
      </div>
    </div>
  );
};

const MetricTile: React.FC<{ label: string; value: string; unit?: string; tone: string; custom?: React.ReactNode }> = ({ label, value, unit, tone, custom }) => (
  <div style={{ background: CARD_HI, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0.7rem 0.85rem" }}>
    <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</div>
    <div style={{ fontSize: "1.05rem", fontWeight: 800, color: tone, marginTop: 4, lineHeight: 1.1 }}>
      {custom ?? <>{value}{unit && <span style={{ fontSize: 11, color: MUTED, marginLeft: 4, fontWeight: 600 }}>{unit}</span>}</>}
    </div>
  </div>
);

const ModeBar: React.FC<{
  icon: string;
  label: string;
  net: number;
  maxNet: number;
  isBest: boolean;
  color: string;
}> = ({ icon, label, net, maxNet, isBest, color }) => {
  const pct = Math.max(2, Math.min(100, (Math.max(0, net) / Math.max(1, maxNet)) * 100));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: TEXT, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 18 }}>{icon}</span> {label}
          {isBest && (
            <span style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em",
              padding: "1px 7px", borderRadius: 999,
              background: color + "20", color, border: `1px solid ${color}50`,
            }}>★ WINNER</span>
          )}
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: net >= 0 ? color : RED }}>
          {net >= 0 ? formatINR(net) : `- ${formatINR(Math.abs(net))}`}
        </span>
      </div>
      <div style={{
        width: "100%", height: 10, background: "rgba(255,255,255,0.05)",
        border: `1px solid ${BORDER}`, borderRadius: 6, overflow: "hidden",
      }}>
        <div style={{
          // @ts-expect-error CSS variable
          "--target": `${pct}%`,
          width: `${pct}%`, height: "100%",
          background: net >= 0 ? `linear-gradient(90deg, ${color}99, ${color})` : "linear-gradient(90deg,#ef4444aa,#ef4444)",
          borderRadius: 6,
          animation: "ki-grow-bar .9s cubic-bezier(.2,.7,.2,1) both",
          boxShadow: isBest ? `0 0 14px ${color}55` : "none",
        }} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// FullComparison — collapsed by default. The raw side-by-side table for power
// users; the primary experience is the ranking above.
// ─────────────────────────────────────────────────────────────────────────────
const FullComparison: React.FC<{ recs: Recommendation[]; acres: number }> = ({ recs, acres }) => {
  const { t, locale } = useI18n();

  type Row = {
    key: string; label: string;
    values: Array<{ raw: number; display: string; tone?: string }>;
    lowerIsBetter?: boolean; isMoney?: boolean;
  };

  const rows: Row[] = [
    { key: "net-total",   label: `${t("row.profit.best")} (${acres} ${t("advisor.acres")})`, isMoney: true,
      values: recs.map((r) => ({ raw: r.bestNet * acres, display: formatINR(r.bestNet * acres) })) },
    { key: "net-chem",    label: t("row.profit.chemical"), isMoney: true,
      values: recs.map((r) => ({ raw: r.chemical.net, display: formatINR(r.chemical.net) })) },
    { key: "net-org",     label: t("row.profit.organic"), isMoney: true,
      values: recs.map((r) => ({ raw: r.organic.net, display: formatINR(r.organic.net) })) },
    { key: "yield",       label: t("row.yield.chemical"),
      values: recs.map((r) => ({ raw: r.chemical.yieldQtl, display: `${r.chemical.yieldQtl} ${t("card.unit.qtl")}` })) },
    { key: "price-now",   label: t("row.price.now"), isMoney: true,
      values: recs.map((r) => ({ raw: r.priceToday, display: formatINR(r.priceToday) })) },
    { key: "price-fwd",   label: t("row.price.forecast"), isMoney: true,
      values: recs.map((r) => ({ raw: r.priceAtHarvest, display: formatINR(r.priceAtHarvest), tone: r.priceAtHarvest > r.priceToday ? GREEN : r.priceAtHarvest < r.priceToday ? RED : undefined })) },
    { key: "soil",        label: t("row.soil.match"),
      values: recs.map((r) => ({ raw: r.soilMatchPct, display: `${r.soilMatchPct}%` })) },
    { key: "weather",     label: t("row.weather.match"),
      values: recs.map((r) => ({ raw: r.weatherMatchPct, display: `${r.weatherMatchPct}%` })) },
    { key: "days",        label: t("row.days"), lowerIsBetter: true,
      values: recs.map((r) => ({ raw: r.daysToHarvest, display: `${r.daysToHarvest}` })) },
  ];

  return (
    <section style={{ marginBottom: "2rem" }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: TEXT, letterSpacing: "-0.02em", marginBottom: 4 }}>
        📊 {t("compare.title")}
      </h2>
      <p style={{ fontSize: 12, color: TEXT_DIM, marginBottom: 12 }}>{t("compare.sub")}</p>

      <div style={{
        background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14,
        overflowX: "auto", WebkitOverflowScrolling: "touch",
      }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ ...thSt, position: "sticky", left: 0, background: CARD, zIndex: 2, textAlign: "left" }}>{t("compare.metric")}</th>
              {recs.map((r, i) => (
                <th key={r.crop.id} style={{ ...thSt, textAlign: "center", minWidth: 130 }}>
                  <div style={{ fontSize: "1.3rem", marginBottom: 2 }}>{r.crop.emoji}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: TEXT }}>{cropName(r.crop, locale)}</div>
                  {i === 0 && <span style={{
                    display: "inline-block", marginTop: 4, padding: "1px 8px", borderRadius: 999,
                    fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
                    background: "rgba(34,197,94,0.18)", color: GREEN, border: `1px solid ${GREEN}40`,
                  }}>★ TOP</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              let bestIdx = 0;
              row.values.forEach((v, i) => {
                const better = row.lowerIsBetter ? v.raw < row.values[bestIdx].raw : v.raw > row.values[bestIdx].raw;
                if (better) bestIdx = i;
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
                        background: isBest ? "rgba(34,197,94,0.06)" : "transparent",
                        color, fontWeight: isBest ? 800 : 600,
                      }}>{v.display}{isBest && row.isMoney ? " 🏆" : ""}</td>
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
  padding: "0.8rem 0.85rem",
  fontSize: 12, fontWeight: 700, color: MUTED,
  letterSpacing: "0.04em", textTransform: "uppercase",
  borderBottom: `1px solid ${BORDER}`,
};
const tdSt: React.CSSProperties = {
  padding: "0.65rem 0.85rem",
  fontSize: 13, color: TEXT, whiteSpace: "nowrap",
};

// ─────────────────────────────────────────────────────────────────────────────
// Empty state.
// ─────────────────────────────────────────────────────────────────────────────
const EmptyState: React.FC = () => {
  const { t } = useI18n();
  return (
    <div style={{
      background: CARD, border: `1px dashed ${BORDER}`, borderRadius: 16,
      padding: "2.5rem 1.5rem", textAlign: "center", color: MUTED,
    }}>
      <div className="ki-anim-bounce" style={{ fontSize: "2.4rem", marginBottom: 8 }}>📍</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{t("advisor.use.location")}</div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const inputCardSt: React.CSSProperties = {
  background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16,
  padding: "1.2rem 1.3rem", marginBottom: "1.5rem",
};

const fieldLabelSt: React.CSSProperties = {
  display: "block", fontSize: 11, color: MUTED,
  fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
  marginBottom: 8,
};

const customAcreInputSt: React.CSSProperties = {
  background: CARD_HI, border: `1px solid ${BORDER}`,
  borderRadius: 999, color: TEXT, padding: "0.45rem 0.9rem",
  fontSize: 14, width: 100, outline: "none", fontFamily: "inherit",
};

const pillBtn = (active: boolean): React.CSSProperties => ({
  padding: "0.55rem 1.05rem", borderRadius: 999,
  background: active ? `linear-gradient(180deg, ${GREEN}30, ${GREEN}18)` : CARD_HI,
  border: `1px solid ${active ? GREEN : BORDER}`,
  color: active ? GREEN : TEXT,
  fontSize: 13, fontWeight: active ? 800 : 600,
  cursor: "pointer", fontFamily: "inherit",
  transition: "background 0.15s, border-color 0.15s, transform 0.1s",
  boxShadow: active ? `0 4px 14px ${GREEN}26` : "none",
});

const speakBtn = (color: string): React.CSSProperties => ({
  padding: "0.55rem 1rem", borderRadius: 10,
  background: color + "15", color,
  border: `1px solid ${color}40`,
  fontSize: 13, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
});

export default DecisionEngine;
