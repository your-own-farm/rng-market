// ── Profit Calculator (data.gov.in-driven) ────────────────────────────────────
// What the farmer sees:
//
//   1. State + crop pickers — drives every other panel.
//   2. 🔒 Today's mandi prices       (LOCKED — from data.gov.in)
//        min / median / max from the last 7 days of mandi reports.
//   3. 🔒 Last harvest season prices (LOCKED — from data.gov.in)
//        Same crop, same ±21-day window one year ago. Year-over-year delta.
//   4. Your inputs                   (editable)
//        Land area, organic vs chemical, yield range, input cost.
//   5. Profit envelope               (computed)
//        Worst-case (low yield × min price) → median → best-case range,
//        rendered as a range bar with the median marked, plus a delta vs
//        "what you'd have earned last harvest at those prices".
//
// Yield & cost defaults still come from the offline crop KB (no public OGD
// source for input costs or per-acre yields), but the moment the OGD history
// arrives the price card flips from "—" to live numbers without re-renders
// elsewhere.

import React from "react";
import { useI18n } from "../i18n";
import { CROPS, cropName } from "../crops";
import { CropPriceVM } from "../types";
import { fetchPriceRanges, PriceComparison, PriceRange, HAS_AGMARKNET_KEY } from "../useAgmarknet";
import { STATES } from "../geo";
import {
  Dropdown, DropdownOption, SectionTitle, Pill, Stat, formatINR,
  CARD, CARD_HI, BORDER, GREEN, RED, AMBER, BLUE, VIOLET, MUTED, TEXT, TEXT_DIM,
} from "../ui";
import { AnimatedINR, FadeUp } from "../animations";

interface Props { prices: CropPriceVM[] }

const STORAGE_KEY = "kinsar.calculator.inputs";
type Mode = "organic" | "chemical";
interface CalcState {
  cropId:   string;
  stateName: string;
  acres:    number;
  mode:     Mode;
  yieldLo:  number;
  yieldHi:  number;
  cost:     number;
}

function loadInputs(defaultCrop: string): CalcState {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      cropId:   raw.cropId   || defaultCrop,
      stateName: raw.stateName || "",
      acres:    raw.acres    || 1,
      mode:     raw.mode     || "chemical",
      yieldLo:  raw.yieldLo  ?? 0,
      yieldHi:  raw.yieldHi  ?? 0,
      cost:     raw.cost     ?? 0,
    };
  } catch {
    return { cropId: defaultCrop, stateName: "", acres: 1, mode: "chemical", yieldLo: 0, yieldHi: 0, cost: 0 };
  }
}
function saveInputs(s: CalcState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────

const Calculator: React.FC<Props> = ({ prices }) => {
  const { t, locale } = useI18n();
  const [s, setS] = React.useState<CalcState>(() => loadInputs(CROPS[0].id));
  const crop = React.useMemo(() => CROPS.find((c) => c.id === s.cropId) ?? CROPS[0], [s.cropId]);

  const [comparison, setComparison] = React.useState<PriceComparison | null>(null);
  const [loadingCmp, setLoadingCmp] = React.useState(false);

  // ── Persist on every change ─────────────────────────────────────────────
  React.useEffect(() => { saveInputs(s); }, [s]);

  // ── Reset yield/cost defaults whenever the user picks a different crop /
  //    mode, unless they've already typed custom numbers for this combination.
  React.useEffect(() => {
    setS((prev) => {
      const needsYieldDefault = prev.yieldLo === 0 || prev.yieldHi === 0;
      const needsCostDefault  = prev.cost    === 0;
      return {
        ...prev,
        yieldLo: needsYieldDefault ? crop.yieldQtlPerAcre.low  : prev.yieldLo,
        yieldHi: needsYieldDefault ? crop.yieldQtlPerAcre.high : prev.yieldHi,
        cost:    needsCostDefault  ? crop.inputCost[prev.mode === "organic" ? "organic" : "urea"] : prev.cost,
      };
    });
    // Re-pull defaults whenever the user explicitly switches crop. mode
    // change is handled in its setter below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.cropId]);

  // ── Fetch live + historical price comparison from data.gov.in ──────────
  React.useEffect(() => {
    if (!HAS_AGMARKNET_KEY) { setComparison(null); return; }
    let cancelled = false;
    setLoadingCmp(true);
    fetchPriceRanges(s.cropId, s.stateName || null)
      .then((cmp) => { if (!cancelled) setComparison(cmp); })
      .catch(() => { if (!cancelled) setComparison(null); })
      .finally(() => { if (!cancelled) setLoadingCmp(false); });
    return () => { cancelled = true; };
  }, [s.cropId, s.stateName]);

  // Fallback price range when OGD is unavailable — derive from any live
  // prices we already have plus the crop's base floor.
  const liveFallback: PriceRange | null = React.useMemo(() => {
    const matches = prices.filter((p) =>
      p.crop.toLowerCase() === crop.id.toLowerCase() || p.crop.toLowerCase().includes(crop.id)
    );
    if (matches.length === 0) return null;
    const sorted = matches.map((p) => p.price).sort((a, b) => a - b);
    return {
      min:     sorted[0],
      max:     sorted[sorted.length - 1],
      median:  sorted[Math.floor(sorted.length / 2)],
      samples: matches.length,
      windowFrom: new Date().toISOString().slice(0, 10),
      windowTo:   new Date().toISOString().slice(0, 10),
    };
  }, [prices, crop.id]);

  const today      = comparison?.today      ?? liveFallback;
  const lastSeason = comparison?.lastSeason ?? null;

  // ── Profit computation ──────────────────────────────────────────────────
  const acres = Math.max(0.25, s.acres);
  const profit = React.useMemo(() => {
    if (!today) return null;
    const lowY = Math.max(0, Math.min(s.yieldLo, s.yieldHi));
    const hiY  = Math.max(s.yieldLo, s.yieldHi);
    const c    = Math.max(0, s.cost);
    const cost = c * acres;
    return {
      worst:   Math.round(lowY * today.min    * acres - cost),
      likely:  Math.round(((lowY + hiY) / 2) * today.median * acres - cost),
      best:    Math.round(hiY  * today.max    * acres - cost),
      cost,
    };
  }, [today, s.yieldLo, s.yieldHi, s.cost, acres]);

  const lastYearProfit = React.useMemo(() => {
    if (!lastSeason) return null;
    const avgY = (s.yieldLo + s.yieldHi) / 2;
    return Math.round(avgY * lastSeason.median * acres - s.cost * acres);
  }, [lastSeason, s.yieldLo, s.yieldHi, s.cost, acres]);

  // ── Picker options ──────────────────────────────────────────────────────
  const cropOptions: DropdownOption[]  = CROPS.map((cr) => ({ value: cr.id, label: `${cr.emoji}  ${cropName(cr, locale)}` }));
  const stateOptions: DropdownOption[] = [
    { value: "",  label: "All states (national median)" },
    ...STATES.map((st) => ({ value: st.name, label: st.name })),
  ];
  const modeOptions: DropdownOption[] = [
    { value: "chemical", label: `⚗️  ${t("calc.mode.urea")}` },
    { value: "organic",  label: `🌿  ${t("calc.mode.organic")}` },
  ];

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div>
      <SectionTitle title={`🧮 ${t("calc.title")}`} sub={t("calc.sub")} />

      {/* ── Crop + state pickers ───────────────────────────────────────── */}
      <FadeUp>
        <div style={{
          background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16,
          padding: "1rem 1.1rem", marginBottom: "1rem",
          display: "grid", gap: "0.6rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        }}>
          <Dropdown icon="🌾"  value={s.cropId}    options={cropOptions}  onChange={(v) => setS({ ...s, cropId: v, yieldLo: 0, yieldHi: 0, cost: 0 })} />
          <Dropdown icon="📍"  value={s.stateName} options={stateOptions} onChange={(v) => setS({ ...s, stateName: v })} />
        </div>
      </FadeUp>

      {/* ── 🔒 Live prices (locked) ─────────────────────────────────────── */}
      <FadeUp delay={80}>
        <LockedPriceCard
          title={t("calc.live.title")}
          sub={t("calc.live.sub")}
          range={today}
          loading={loadingCmp && !today}
          tone={GREEN}
          windowLabel="last 7 days"
        />
      </FadeUp>

      {/* ── 🔒 Last harvest season (locked) ─────────────────────────────── */}
      <FadeUp delay={150}>
        <LockedPriceCard
          title={t("calc.last.title")}
          sub={t("calc.last.sub")}
          range={lastSeason}
          loading={loadingCmp && !lastSeason}
          tone={VIOLET}
          windowLabel="±21 days, one year ago"
          missingText={t("calc.last.missing")}
        />
      </FadeUp>

      {/* ── YoY callout ────────────────────────────────────────────────── */}
      {comparison?.yoyPct != null && today && lastSeason && (
        <FadeUp delay={200}>
          <YoYBanner yoy={comparison.yoyPct} today={today.median} last={lastSeason.median} />
        </FadeUp>
      )}

      {/* ── Editable inputs ────────────────────────────────────────────── */}
      <FadeUp delay={250}>
        <div style={{
          background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16,
          padding: "1.1rem 1.2rem", marginBottom: "1rem",
        }}>
          <div style={{ fontSize: 12, color: MUTED, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
            ✏️ {t("calc.inputs")}
          </div>
          <p style={{ fontSize: 12, color: TEXT_DIM, marginBottom: "0.9rem" }}>{t("calc.inputs.sub")}</p>

          <div style={{ display: "grid", gap: "0.8rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <Field label={t("calc.acres")}>
              <NumberIn value={s.acres} step={0.25} min={0.25} onChange={(n) => setS({ ...s, acres: n })} suffix={t("advisor.acres")} />
            </Field>
            <Field label={t("calc.mode")}>
              <Dropdown icon="🧪" value={s.mode} options={modeOptions} onChange={(v) => setS({ ...s, mode: v as Mode, cost: crop.inputCost[v === "organic" ? "organic" : "urea"] })} />
            </Field>
            <Field label={t("calc.yield.range")}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <NumberIn value={s.yieldLo} step={1} min={0} onChange={(n) => setS({ ...s, yieldLo: n })} suffix="qtl" />
                <span style={{ color: MUTED, fontSize: 13 }}>–</span>
                <NumberIn value={s.yieldHi} step={1} min={0} onChange={(n) => setS({ ...s, yieldHi: n })} suffix="qtl" />
              </div>
            </Field>
            <Field label={`${t("calc.cost")} (₹/acre)`}>
              <NumberIn value={s.cost} step={500} min={0} onChange={(n) => setS({ ...s, cost: n })} prefix="₹" />
            </Field>
          </div>
        </div>
      </FadeUp>

      {/* ── Profit envelope ────────────────────────────────────────────── */}
      <FadeUp delay={320}>
        <ProfitOutput
          profit={profit}
          lastYearProfit={lastYearProfit}
          acres={acres}
          cropEmoji={crop.emoji}
          cropLabel={cropName(crop, locale)}
        />
      </FadeUp>

      <p style={{ fontSize: 11, color: MUTED, textAlign: "center", marginTop: "1rem", lineHeight: 1.6 }}>
        {t("kb.disclaimer")}
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LockedPriceCard — read-only mandi range pulled from data.gov.in.
// ─────────────────────────────────────────────────────────────────────────────
const LockedPriceCard: React.FC<{
  title: string;
  sub: string;
  range: PriceRange | null;
  loading: boolean;
  tone: string;
  windowLabel?: string;
  missingText?: string;
}> = ({ title, sub, range, loading, tone, windowLabel, missingText }) => {
  const { t } = useI18n();
  return (
    <div style={{
      background: `linear-gradient(135deg, ${tone}10, ${CARD})`,
      border: `1px solid ${tone}40`, borderRadius: 16,
      padding: "1.1rem 1.2rem", marginBottom: "0.8rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "1rem", fontWeight: 800, color: TEXT, letterSpacing: "-0.01em" }}>{title}</div>
          <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 2 }}>{sub}</div>
        </div>
        <Pill color={tone}>{t("calc.locked")}</Pill>
      </div>

      {loading ? (
        <div className="ki-shimmer" style={{ height: 76, borderRadius: 10 }} />
      ) : !range ? (
        <p style={{ fontSize: 13, color: MUTED, fontStyle: "italic", marginTop: 10 }}>
          {missingText ?? "—"}
        </p>
      ) : (
        <>
          {/* Range row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10, alignItems: "end" }}>
            <RangePoint label={t("calc.range.min")}    value={range.min}    tone={MUTED} />
            <RangePoint label={t("calc.range.median")} value={range.median} tone={tone} big />
            <RangePoint label={t("calc.range.max")}    value={range.max}    tone={MUTED} align="right" />
          </div>

          {/* Range bar */}
          <RangeSlider min={range.min} median={range.median} max={range.max} color={tone} />

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: MUTED }}>
            <span>{windowLabel ?? ""}</span>
            <span>{t("calc.markets.reporting", { n: range.samples })}</span>
          </div>
        </>
      )}
    </div>
  );
};

const RangePoint: React.FC<{ label: string; value: number; tone: string; big?: boolean; align?: "left" | "right" }> = ({ label, value, tone, big, align }) => (
  <div style={{ textAlign: align === "right" ? "right" : "left" }}>
    <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</div>
    <div style={{ fontSize: big ? "1.55rem" : "1.05rem", fontWeight: big ? 900 : 800, color: tone, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
      ₹{value.toLocaleString("en-IN")}
      <span style={{ fontSize: 11, color: MUTED, fontWeight: 600, marginLeft: 4 }}>/qtl</span>
    </div>
  </div>
);

const RangeSlider: React.FC<{ min: number; median: number; max: number; color: string }> = ({ min, median, max, color }) => {
  const range = Math.max(1, max - min);
  const pct = ((median - min) / range) * 100;
  return (
    <div style={{
      marginTop: 12, position: "relative",
      height: 10, borderRadius: 999,
      background: `linear-gradient(90deg, ${color}33, ${color}88, ${color}33)`,
      border: `1px solid ${color}40`,
    }}>
      <div style={{
        position: "absolute",
        left: `${pct}%`, top: -3,
        width: 16, height: 16, borderRadius: "50%",
        background: color,
        border: "2px solid #0b1120",
        boxShadow: `0 0 12px ${color}aa`,
        transform: "translateX(-8px)",
      }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// YoYBanner — visual cue for "prices up/flat/down vs last year".
// ─────────────────────────────────────────────────────────────────────────────
const YoYBanner: React.FC<{ yoy: number; today: number; last: number }> = ({ yoy, today, last }) => {
  const { t } = useI18n();
  const up = yoy > 1.5, down = yoy < -1.5;
  const tone = up ? GREEN : down ? RED : AMBER;
  const arrow = up ? "📈" : down ? "📉" : "➡️";
  const verdict = up ? t("calc.yoy.up") : down ? t("calc.yoy.down") : t("calc.yoy.flat");
  return (
    <div style={{
      background: tone + "12", border: `1px solid ${tone}40`,
      borderRadius: 14, padding: "0.9rem 1.1rem",
      marginBottom: "1rem",
      display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
    }}>
      <span style={{ fontSize: 28 }}>{arrow}</span>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: tone, letterSpacing: "-0.01em" }}>
          {yoy > 0 ? "+" : ""}{yoy.toFixed(1)}% {t("calc.vs.last")}
        </div>
        <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 2 }}>{verdict}</div>
      </div>
      <div style={{ textAlign: "right", fontSize: 11, color: MUTED }}>
        ₹{last.toLocaleString("en-IN")} → ₹{today.toLocaleString("en-IN")}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ProfitOutput — worst / likely / best with a range bar.
// ─────────────────────────────────────────────────────────────────────────────
const ProfitOutput: React.FC<{
  profit: { worst: number; likely: number; best: number; cost: number } | null;
  lastYearProfit: number | null;
  acres: number;
  cropEmoji: string;
  cropLabel: string;
}> = ({ profit, lastYearProfit, acres, cropEmoji, cropLabel }) => {
  const { t } = useI18n();
  if (!profit) {
    return (
      <div style={{
        background: CARD, border: `1px dashed ${BORDER}`, borderRadius: 16,
        padding: "1.5rem", textAlign: "center", color: MUTED,
      }}>
        {t("calc.fetching")}
      </div>
    );
  }

  const profitable = profit.likely >= 0;
  const tone = profitable ? GREEN : RED;
  const range = Math.max(1, profit.best - profit.worst);
  const likelyPct = ((profit.likely - profit.worst) / range) * 100;
  const deltaVsLast = lastYearProfit != null ? profit.likely - lastYearProfit : null;

  return (
    <div style={{
      background: `linear-gradient(135deg, ${tone}10, ${CARD})`,
      border: `1px solid ${tone}55`, borderRadius: 18,
      padding: "1.3rem 1.4rem",
      boxShadow: profitable ? `0 10px 40px ${tone}1f` : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: "1.8rem" }}>{cropEmoji}</span>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: "1.05rem", fontWeight: 800, color: TEXT, lineHeight: 1.2 }}>
            {t("calc.profit.title")}
          </div>
          <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 2 }}>{cropLabel} · {acres} {t("advisor.acres")}</div>
        </div>
      </div>

      {/* Three-point summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: "0.9rem", alignItems: "end" }}>
        <RangePoint label={t("calc.profit.worst")}  value={profit.worst}  tone={MUTED} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {t("calc.profit.likely")}
          </div>
          <div style={{ fontSize: "1.9rem", fontWeight: 900, color: tone, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            <AnimatedINR value={profit.likely} duration={1100} />
          </div>
        </div>
        <RangePoint label={t("calc.profit.best")} value={profit.best} tone={MUTED} align="right" />
      </div>

      {/* Range bar */}
      <div style={{ marginTop: 14, position: "relative", height: 12, borderRadius: 999,
        background: `linear-gradient(90deg, ${RED}33 0%, ${AMBER}33 50%, ${GREEN}33 100%)`,
        border: `1px solid ${BORDER}`,
      }}>
        <div style={{
          position: "absolute",
          left: `${Math.max(0, Math.min(100, likelyPct))}%`, top: -4,
          width: 18, height: 18, borderRadius: "50%",
          background: tone, border: "2px solid #0b1120",
          boxShadow: `0 0 16px ${tone}aa`,
          transform: "translateX(-9px)",
        }} />
      </div>

      <p style={{ fontSize: 11, color: MUTED, marginTop: 8, lineHeight: 1.6 }}>
        {t("calc.profit.sub")}
      </p>

      {/* vs Last harvest */}
      {deltaVsLast != null && lastYearProfit != null && (
        <div style={{
          marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
        }}>
          <div style={{ fontSize: 12, color: TEXT_DIM }}>
            {t("calc.vs.last")} ({formatINR(lastYearProfit)})
          </div>
          <div style={{
            fontSize: 14, fontWeight: 800,
            color: deltaVsLast >= 0 ? GREEN : RED,
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 10px", borderRadius: 999,
            background: (deltaVsLast >= 0 ? GREEN : RED) + "14",
            border: `1px solid ${(deltaVsLast >= 0 ? GREEN : RED)}40`,
          }}>
            {deltaVsLast >= 0 ? "↑" : "↓"} {formatINR(Math.abs(deltaVsLast))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tiny helpers reused inside the editable card.
// ─────────────────────────────────────────────────────────────────────────────
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label style={{ display: "block", fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>{label}</label>
    {children}
  </div>
);

const NumberIn: React.FC<{ value: number; step: number; min: number; onChange: (n: number) => void; prefix?: string; suffix?: string }> = ({ value, step, min, onChange, prefix, suffix }) => (
  <div style={{
    display: "flex", alignItems: "center",
    background: CARD_HI, border: `1px solid ${BORDER}`,
    borderRadius: 10, padding: "0.45rem 0.7rem",
  }}>
    {prefix && <span style={{ color: MUTED, fontSize: 13, marginRight: 4 }}>{prefix}</span>}
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      step={step}
      min={min}
      onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
      style={{
        background: "transparent", border: "none", outline: "none",
        color: TEXT, fontSize: 14, fontFamily: "inherit",
        width: "100%", minWidth: 60,
      }}
    />
    {suffix && <span style={{ color: MUTED, fontSize: 11, marginLeft: 4 }}>{suffix}</span>}
  </div>
);

export default Calculator;
