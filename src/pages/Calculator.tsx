// ── Profit Calculator ────────────────────────────────────────────────────────
// Standalone calculator — pick crop, acres, mode → see breakdown.
// Pre-fills yield, price and input cost from the crop knowledge base, then lets
// the farmer override any value to model their own scenario.

import React from "react";
import { useI18n } from "../i18n";
import { CROPS, cropName } from "../crops";
import { CropPriceVM } from "../types";
import {
  Dropdown, DropdownOption, SectionTitle, Stat, formatINR,
  CARD, CARD_HI, BORDER, GREEN, RED, AMBER, MUTED, TEXT, TEXT_DIM,
} from "../ui";

interface Props { prices: CropPriceVM[] }

const Calculator: React.FC<Props> = ({ prices }) => {
  const { t, locale } = useI18n();
  const [cropId, setCropId] = React.useState<string>(CROPS[0].id);
  const [acres,  setAcres]  = React.useState<number>(1);
  const [mode,   setMode]   = React.useState<"organic" | "urea">("urea");
  const [yieldQ, setYieldQ] = React.useState<number | null>(null);
  const [price,  setPrice]  = React.useState<number | null>(null);
  const [cost,   setCost]   = React.useState<number | null>(null);

  const crop = CROPS.find((c) => c.id === cropId)!;

  // Recompute defaults when crop/mode changes (only if user hasn't overridden).
  React.useEffect(() => {
    setYieldQ(crop.yieldQtlPerAcre.avg);
    const livePrice = prices.find((p) => p.crop.toLowerCase() === crop.id.toLowerCase());
    setPrice(livePrice ? Math.round(livePrice.price) : crop.baseFloorPrice);
    setCost(crop.inputCost[mode]);
  }, [cropId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const y = yieldQ ?? 0;
  const p = price  ?? 0;
  const c = cost   ?? 0;

  const revenuePerAcre = y * p;
  const netPerAcre     = revenuePerAcre - c;
  const totalRevenue   = revenuePerAcre * acres;
  const totalCost      = c * acres;
  const totalNet       = netPerAcre * acres;
  const profitable     = totalNet >= 0;

  const cropOptions: DropdownOption[] = CROPS.map((cr) => ({
    value: cr.id, label: `${cr.emoji}  ${cropName(cr, locale)}`,
  }));

  const modeOptions: DropdownOption[] = [
    { value: "urea",    label: t("calc.mode.urea") },
    { value: "organic", label: t("calc.mode.organic") },
  ];

  return (
    <div>
      <SectionTitle title={`🧮 ${t("calc.title")}`} sub={t("calc.sub")} />

      <div style={{
        display: "grid", gap: "1.2rem",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
      }} className="calc-grid">
        <style>{`
          @media (max-width: 760px) {
            .calc-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>

        {/* Inputs */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "1.3rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          <Field label={t("calc.crop")}>
            <Dropdown icon="🌾" value={cropId} options={cropOptions} onChange={setCropId} />
          </Field>
          <Field label={t("calc.acres")}>
            <NumberIn value={acres} step={0.25} min={0.25} onChange={setAcres} />
          </Field>
          <Field label={t("calc.mode")}>
            <Dropdown icon="🧪" value={mode} options={modeOptions} onChange={(v) => setMode(v as any)} />
          </Field>
          <Field label={t("calc.yield")}>
            <NumberIn value={yieldQ ?? 0} step={1} min={0} onChange={setYieldQ} />
          </Field>
          <Field label={t("calc.price")}>
            <NumberIn value={price ?? 0} step={50} min={0} onChange={setPrice} />
          </Field>
          <Field label={t("calc.cost")}>
            <NumberIn value={cost ?? 0} step={500} min={0} onChange={setCost} />
          </Field>
        </div>

        {/* Output */}
        <div style={{
          background: profitable
            ? "linear-gradient(135deg, rgba(34,197,94,0.10), rgba(34,197,94,0.04))"
            : "linear-gradient(135deg, rgba(239,68,68,0.10), rgba(239,68,68,0.04))",
          border: `1px solid ${profitable ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
          borderRadius: 16, padding: "1.4rem", display: "flex", flexDirection: "column", gap: "0.85rem",
        }}>
          <div>
            <span style={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {profitable ? t("calc.net.profit") : t("calc.loss")}
            </span>
            <div style={{
              fontSize: "2.4rem", fontWeight: 900,
              color: profitable ? GREEN : RED,
              letterSpacing: "-0.03em", lineHeight: 1.1,
            }}>
              {formatINR(Math.abs(totalNet))}
            </div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
              {acres} {t("advisor.acres")} · {crop.emoji} {cropName(crop, locale)}
            </div>
          </div>

          <div style={{ paddingTop: "0.5rem", borderTop: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {t("calc.breakdown")}
            </span>
            <div style={{ marginTop: 6 }}>
              <Stat label={t("calc.total.revenue")} value={formatINR(totalRevenue)} tone="good" />
              <Stat label={t("calc.total.cost")}    value={formatINR(totalCost)}    tone="bad" />
              <Stat label={t("calc.per.acre.net")}  value={formatINR(netPerAcre)}   tone={netPerAcre >= 0 ? "good" : "bad"} />
            </div>
          </div>

          <p style={{ fontSize: 11, color: MUTED, lineHeight: 1.6, marginTop: "0.4rem" }}>
            {t("kb.disclaimer")}
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Tiny field helpers ───────────────────────────────────────────────────────
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label style={{ display: "block", fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>{label}</label>
    {children}
  </div>
);

const NumberIn: React.FC<{ value: number; step: number; min: number; onChange: (n: number) => void }> = ({ value, step, min, onChange }) => (
  <input
    type="number"
    value={Number.isFinite(value) ? value : 0}
    step={step}
    min={min}
    onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
    style={{
      background: CARD_HI, border: `1px solid ${BORDER}`,
      borderRadius: 10, color: TEXT, padding: "0.6rem 0.9rem",
      fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit",
    }}
  />
);

export default Calculator;
