import React from "react";
import { usePrices } from "./usePrices";
import { CropPriceVM, Trend, SellAdvice } from "./types";

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG      = "#0b1120";
const CARD    = "rgba(255,255,255,0.04)";
const BORDER  = "rgba(255,255,255,0.08)";
const GREEN   = "#22c55e";
const RED     = "#ef4444";
const AMBER   = "#f59e0b";
const BLUE    = "#38bdf8";
const MUTED   = "#64748b";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtPrice(p: number) {
  return "₹" + p.toLocaleString("en-IN");
}

function timeSince(ts: number) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const trendColor: Record<Trend, string> = { up: GREEN, down: RED, stable: AMBER };
const trendArrow: Record<Trend, string> = { up: "↑", down: "↓", stable: "→" };

const adviceConfig: Record<SellAdvice, { label: string; color: string; bg: string; icon: string }> = {
  "sell-now": { label: "Sell Now",  color: GREEN, bg: "rgba(34,197,94,0.12)",  icon: "🟢" },
  "hold":     { label: "Hold",      color: RED,   bg: "rgba(239,68,68,0.12)",  icon: "🔴" },
  "watch":    { label: "Watch",     color: AMBER, bg: "rgba(245,158,11,0.12)", icon: "🟡" },
};

// ── Subcomponents ─────────────────────────────────────────────────────────────

const LiveBadge: React.FC<{ live: boolean }> = ({ live }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "4px 12px", borderRadius: 100,
    background: live ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
    border: `1px solid ${live ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)"}`,
    fontSize: 12, fontWeight: 700, color: live ? GREEN : AMBER,
    letterSpacing: "0.04em",
  }}>
    <span style={{
      width: 7, height: 7, borderRadius: "50%",
      background: live ? GREEN : AMBER,
      animation: "pulse 2s ease-in-out infinite",
    }} />
    {live ? "LIVE" : "DEMO · Simulated"}
  </span>
);

const PriceCard: React.FC<{ p: CropPriceVM }> = ({ p }) => {
  const [flash, setFlash] = React.useState(false);
  const prev = React.useRef(p.price);

  React.useEffect(() => {
    if (p.price !== prev.current) {
      setFlash(true);
      prev.current = p.price;
      const t = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(t);
    }
  }, [p.price]);

  const adv = adviceConfig[p.advice];
  const color = trendColor[p.trend];

  return (
    <article style={{
      background: flash ? `rgba(${p.trend === "up" ? "34,197,94" : p.trend === "down" ? "239,68,68" : "245,158,11"},0.07)` : CARD,
      border: `1px solid ${flash ? color + "44" : BORDER}`,
      borderRadius: 16,
      padding: "1.4rem",
      transition: "background 0.4s, border-color 0.4s",
      display: "flex", flexDirection: "column", gap: "0.75rem",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#e2e8f0", marginBottom: 2 }}>{p.crop}</h3>
          <span style={{ fontSize: 12, color: MUTED }}>📍 {p.district}, {p.state}</span>
        </div>
        <span style={{
          padding: "3px 10px", borderRadius: 8,
          background: adv.bg, color: adv.color,
          fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
          whiteSpace: "nowrap",
        }}>{adv.icon} {adv.label}</span>
      </div>

      {/* Price */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: "1.8rem", fontWeight: 800, color, letterSpacing: "-0.03em", lineHeight: 1 }}>
          {fmtPrice(p.price)}
        </span>
        <span style={{ fontSize: 13, color: MUTED }}>/ {p.unit}</span>
      </div>

      {/* Change */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "2px 9px", borderRadius: 6,
          background: color + "18", color,
          fontSize: 13, fontWeight: 700,
        }}>
          {trendArrow[p.trend]} {p.changePct > 0 ? "+" : ""}{p.changePct.toFixed(1)}%
        </span>
        <span style={{ fontSize: 12, color: MUTED }}>vs prev. {fmtPrice(p.prevPrice)}</span>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.25rem", borderTop: `1px solid ${BORDER}` }}>
        <span style={{ fontSize: 12, color: MUTED }}>🏛 {p.market}</span>
        <span style={{ fontSize: 12, color: MUTED }}>{timeSince(p.updatedAt)}</span>
      </div>
    </article>
  );
};

const SummaryBar: React.FC<{ prices: CropPriceVM[] }> = ({ prices }) => {
  const up    = prices.filter(p => p.trend === "up").length;
  const down  = prices.filter(p => p.trend === "down").length;
  const sellNow = prices.filter(p => p.advice === "sell-now").length;

  return (
    <div style={{
      display: "flex", gap: "1rem", flexWrap: "wrap", padding: "1rem 1.4rem",
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14,
      marginBottom: "1.5rem",
    }}>
      {[
        { label: "Rising",     value: up,      color: GREEN },
        { label: "Falling",    value: down,     color: RED  },
        { label: "Stable",     value: prices.length - up - down, color: AMBER },
        { label: "Sell Signals", value: sellNow, color: BLUE },
      ].map(({ label, value, color }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1.2rem", fontWeight: 800, color }}>{value}</span>
          <span style={{ fontSize: 13, color: MUTED }}>{label}</span>
        </div>
      ))}
      <div style={{ marginLeft: "auto", fontSize: 12, color: MUTED, alignSelf: "center" }}>
        {prices.length} crops tracked across {new Set(prices.map(p => p.state)).size} states
      </div>
    </div>
  );
};

// ── Main App ──────────────────────────────────────────────────────────────────
const MarketApp: React.FC = () => {
  const { prices, live } = usePrices();
  const [stateFilter, setStateFilter] = React.useState("all");
  const [adviceFilter, setAdviceFilter] = React.useState<"all" | SellAdvice>("all");
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<"change" | "price" | "updated">("change");

  const states = React.useMemo(
    () => ["all", ...Array.from(new Set(prices.map(p => p.state))).sort()],
    [prices]
  );

  const filtered = React.useMemo(() => {
    let out = prices;
    if (stateFilter !== "all")   out = out.filter(p => p.state === stateFilter);
    if (adviceFilter !== "all")  out = out.filter(p => p.advice === adviceFilter);
    if (search.trim())           out = out.filter(p =>
      p.crop.toLowerCase().includes(search.toLowerCase()) ||
      p.district.toLowerCase().includes(search.toLowerCase())
    );
    return [...out].sort((a, b) =>
      sort === "change"  ? Math.abs(b.changePct) - Math.abs(a.changePct) :
      sort === "price"   ? b.price - a.price :
      b.updatedAt - a.updatedAt
    );
  }, [prices, stateFilter, adviceFilter, search, sort]);

  const inputSt: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`,
    borderRadius: 10, color: "#f1f5f9", padding: "0.55rem 1rem",
    fontSize: 14, outline: "none", colorScheme: "dark",
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: "#f1f5f9" }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── Header ─── */}
      <header style={{
        borderBottom: `1px solid ${BORDER}`,
        background: "rgba(11,17,32,0.95)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.4rem" }}>🌾</span>
            <div>
              <h1 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#e2e8f0", lineHeight: 1.1 }}>Mandi Pulse</h1>
              <p style={{ fontSize: 11, color: MUTED }}>Live crop prices · India</p>
            </div>
          </div>
          <LiveBadge live={live} />
        </div>
      </header>

      {/* ── Hero intro strip ─── */}
      <div style={{
        background: "linear-gradient(135deg, rgba(56,189,248,0.06) 0%, rgba(99,102,241,0.06) 100%)",
        borderBottom: `1px solid ${BORDER}`,
        padding: "1.5rem",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.7, maxWidth: 700 }}>
            Real-time price feeds from APMC mandis across India. Prices update live — use <strong style={{ color: GREEN }}>Sell Now</strong> signals to time your market release and maximise returns.
          </p>
        </div>
      </div>

      {/* ── Main content ─── */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "1.5rem" }}>
        {/* Summary */}
        {prices.length > 0 && <SummaryBar prices={prices} />}

        {/* Filters */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          <input
            type="search"
            placeholder="Search crop or district…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputSt, flex: "1 1 220px", minWidth: 180 }}
          />
          <select value={stateFilter} onChange={e => setStateFilter(e.target.value)} style={inputSt}>
            {states.map(s => <option key={s} value={s}>{s === "all" ? "All States" : s}</option>)}
          </select>
          <select value={adviceFilter} onChange={e => setAdviceFilter(e.target.value as any)} style={inputSt}>
            <option value="all">All Signals</option>
            <option value="sell-now">🟢 Sell Now</option>
            <option value="watch">🟡 Watch</option>
            <option value="hold">🔴 Hold</option>
          </select>
          <select value={sort} onChange={e => setSort(e.target.value as any)} style={inputSt}>
            <option value="change">Sort: Biggest Move</option>
            <option value="price">Sort: Highest Price</option>
            <option value="updated">Sort: Most Recent</option>
          </select>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem", color: MUTED }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🔍</div>
            <p>No crops match your filters.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {filtered.map((p, i) => <PriceCard key={`${p.crop}-${p.district}-${i}`} p={p} />)}
          </div>
        )}

        {/* Data note */}
        <p style={{ fontSize: 12, color: MUTED, textAlign: "center", marginTop: "2.5rem", lineHeight: 1.7 }}>
          {live
            ? "Prices sourced from Firebase Realtime Database · APMC mandi data."
            : "Demo mode — simulated price movements. Connect Firebase Realtime Database to show live mandi data."
          }{" "}
          Sell-timing signals are indicative only and do not constitute financial advice.
        </p>
      </main>
    </div>
  );
};

export default MarketApp;
