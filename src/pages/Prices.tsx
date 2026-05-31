// ── Mandi Prices page ────────────────────────────────────────────────────────
// Live APMC prices streamed from Firebase Realtime Database (sourced upstream
// from data.gov.in by the Python market-price-agent). Falls back to seeded
// demo data when the DB is unreachable.

import React from "react";
import { useI18n } from "../i18n";
import { CropPriceVM, SellAdvice, Trend } from "../types";
import {
  Dropdown, DropdownOption, SectionTitle, Pill, formatINR,
  CARD, CARD_HI, BORDER, GREEN, RED, AMBER, BLUE, MUTED, TEXT, TEXT_DIM,
} from "../ui";
import { PriceSource } from "../usePrices";

interface Props { prices: CropPriceVM[]; live: boolean; source?: PriceSource }

const trendColor: Record<Trend, string> = { up: GREEN, down: RED, stable: AMBER };
const trendArrow: Record<Trend, string> = { up: "↑", down: "↓", stable: "→" };

const Prices: React.FC<Props> = ({ prices, live, source }) => {
  const { t } = useI18n();
  const [stateFilter, setStateFilter] = React.useState("all");
  const [adviceFilter, setAdviceFilter] = React.useState<"all" | SellAdvice>("all");
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<"change" | "price" | "updated">("change");

  const states = React.useMemo(
    () => ["all", ...Array.from(new Set(prices.map((p) => p.state))).sort()],
    [prices]
  );

  const filtered = React.useMemo(() => {
    let out = prices;
    if (stateFilter !== "all")   out = out.filter((p) => p.state === stateFilter);
    if (adviceFilter !== "all")  out = out.filter((p) => p.advice === adviceFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((p) => p.crop.toLowerCase().includes(q) || p.district.toLowerCase().includes(q));
    }
    return [...out].sort((a, b) =>
      sort === "change" ? Math.abs(b.changePct) - Math.abs(a.changePct) :
      sort === "price"  ? b.price - a.price :
      b.updatedAt - a.updatedAt
    );
  }, [prices, stateFilter, adviceFilter, search, sort]);

  const stateOptions: DropdownOption[] = states.map((s) => ({ value: s, label: s === "all" ? t("prices.all.states") : s }));

  const adviceOptions: DropdownOption[] = [
    { value: "all",      label: t("prices.all.signals") },
    { value: "sell-now", label: t("prices.signal.sellnow"), dot: "🟢" },
    { value: "watch",    label: t("prices.signal.watch"),    dot: "🟡" },
    { value: "hold",     label: t("prices.signal.hold"),     dot: "🔴" },
  ];

  const sortOptions: DropdownOption[] = [
    { value: "change",  label: t("prices.sort.move") },
    { value: "price",   label: t("prices.sort.price") },
    { value: "updated", label: t("prices.sort.recent") },
  ];

  return (
    <div>
      <SectionTitle title={`💰 ${t("prices.title")}`} sub={t("prices.sub")} />

      {/* Source attribution */}
      {source && (
        <div style={{ marginBottom: "1rem", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Pill color={source === "demo" ? AMBER : GREEN}>
            {source === "firebase"    ? "Firebase RTDB · live"
             : source === "data.gov.in" ? "data.gov.in · live"
             : "Demo · simulated"}
          </Pill>
          {source !== "demo" && (
            <span style={{ fontSize: 11, color: MUTED }}>
              Source: data.gov.in OGD Platform · Agmarknet APMC daily feed
            </span>
          )}
        </div>
      )}

      {/* Summary */}
      {prices.length > 0 && <SummaryBar prices={prices} t={t} />}

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", marginBottom: "1.4rem" }}>
        <input
          type="search"
          placeholder={t("prices.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: CARD_HI, border: `1px solid ${BORDER}`,
            borderRadius: 10, color: TEXT, padding: "0.6rem 1rem",
            fontSize: 14, outline: "none", flex: "1 1 220px", minWidth: 180,
            fontFamily: "inherit",
          }}
        />
        <Dropdown icon="📍" value={stateFilter}  options={stateOptions}  onChange={setStateFilter} />
        <Dropdown icon="📊" value={adviceFilter} options={adviceOptions} onChange={(v) => setAdviceFilter(v as any)} />
        <Dropdown icon="↕"  value={sort}         options={sortOptions}   onChange={(v) => setSort(v as any)} />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: MUTED }}>
          <div style={{ fontSize: "2.2rem", marginBottom: 8 }}>🔍</div>
          <p>{t("prices.empty")}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {filtered.map((p, i) => <PriceCard key={`${p.crop}-${p.district}-${i}`} p={p} />)}
        </div>
      )}

      <p style={{ fontSize: 12, color: MUTED, textAlign: "center", marginTop: "2rem", lineHeight: 1.7 }}>
        {live
          ? "Prices from Firebase Realtime Database · APMC mandi data via data.gov.in."
          : "Demo mode — simulated price movements. Connect Firebase RTDB to show live data."}
      </p>
    </div>
  );
};

// ── Subcomponents ────────────────────────────────────────────────────────────
const adviceColor: Record<SellAdvice, string> = {
  "sell-now": GREEN, "hold": RED, "watch": AMBER,
};
const adviceIcon: Record<SellAdvice, string> = {
  "sell-now": "🟢", "hold": "🔴", "watch": "🟡",
};

function timeSince(ts: number) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const PriceCard: React.FC<{ p: CropPriceVM }> = ({ p }) => {
  const { t } = useI18n();
  const [flash, setFlash] = React.useState(false);
  const prev = React.useRef(p.price);

  React.useEffect(() => {
    if (p.price !== prev.current) {
      setFlash(true); prev.current = p.price;
      const id = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(id);
    }
  }, [p.price]);

  const color = trendColor[p.trend];
  const adviceLabel = p.advice === "sell-now" ? t("prices.signal.sellnow")
                    : p.advice === "hold"     ? t("prices.signal.hold")
                                              : t("prices.signal.watch");

  return (
    <article style={{
      background: flash
        ? `rgba(${p.trend === "up" ? "34,197,94" : p.trend === "down" ? "239,68,68" : "245,158,11"},0.07)`
        : CARD,
      border: `1px solid ${flash ? color + "44" : BORDER}`,
      borderRadius: 16, padding: "1.3rem",
      transition: "background 0.4s, border-color 0.4s",
      display: "flex", flexDirection: "column", gap: "0.6rem",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#e2e8f0", marginBottom: 2 }}>{p.crop}</h3>
          <span style={{ fontSize: 12, color: MUTED }}>📍 {p.district}, {p.state}</span>
        </div>
        <span style={{
          padding: "3px 9px", borderRadius: 8,
          background: adviceColor[p.advice] + "20", color: adviceColor[p.advice],
          fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
          whiteSpace: "nowrap",
        }}>{adviceIcon[p.advice]} {adviceLabel}</span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: "1.7rem", fontWeight: 800, color, letterSpacing: "-0.03em", lineHeight: 1 }}>
          {formatINR(p.price)}
        </span>
        <span style={{ fontSize: 12, color: MUTED }}>/ {p.unit}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "2px 8px", borderRadius: 6,
          background: color + "18", color, fontSize: 13, fontWeight: 700,
        }}>
          {trendArrow[p.trend]} {p.changePct > 0 ? "+" : ""}{p.changePct.toFixed(1)}%
        </span>
        <span style={{ fontSize: 12, color: MUTED }}>vs {formatINR(p.prevPrice)}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "0.3rem", borderTop: `1px solid ${BORDER}` }}>
        <span style={{ fontSize: 12, color: MUTED }}>🏛 {p.market}</span>
        <span style={{ fontSize: 12, color: MUTED }}>{timeSince(p.updatedAt)}</span>
      </div>
    </article>
  );
};

const SummaryBar: React.FC<{ prices: CropPriceVM[]; t: (k: string) => string }> = ({ prices, t }) => {
  const up      = prices.filter((p) => p.trend === "up").length;
  const down    = prices.filter((p) => p.trend === "down").length;
  const stable  = prices.length - up - down;
  const sellNow = prices.filter((p) => p.advice === "sell-now").length;
  return (
    <div style={{
      display: "flex", gap: "1.2rem", flexWrap: "wrap", padding: "1rem 1.3rem",
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14,
      marginBottom: "1.4rem",
    }}>
      {[
        { label: t("demand.rising"),  value: up,      color: GREEN },
        { label: t("demand.falling"), value: down,    color: RED },
        { label: t("demand.stable"),  value: stable,  color: AMBER },
        { label: t("prices.signal.sellnow"), value: sellNow, color: BLUE },
      ].map(({ label, value, color }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1.2rem", fontWeight: 800, color }}>{value}</span>
          <span style={{ fontSize: 13, color: MUTED }}>{label}</span>
        </div>
      ))}
      <div style={{ marginLeft: "auto", fontSize: 12, color: MUTED, alignSelf: "center" }}>
        {prices.length} crops · {new Set(prices.map((p) => p.state)).size} states
      </div>
    </div>
  );
};

export default Prices;
