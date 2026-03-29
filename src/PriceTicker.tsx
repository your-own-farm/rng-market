/**
 * PriceTicker — compact real-time scrolling ticker strip.
 *
 * Exposed as a Module Federation remote: marketApp/PriceTicker
 *
 * Usage in the host or any other MFE:
 *   const PriceTicker = React.lazy(() => import("marketApp/PriceTicker"));
 *   <PriceTicker stateFilter="Maharashtra" maxItems={8} />
 */
import React from "react";
import { usePrices } from "./usePrices";
import { CropPriceVM, Trend } from "./types";

interface PriceTickerProps {
  /** Only show crops from this state. Omit for all states. */
  stateFilter?: string;
  /** Max number of items scrolling in the ticker (default 10) */
  maxItems?: number;
  /** Height of the ticker bar (default 44px) */
  height?: number;
}

const trendArrow: Record<Trend, string> = { up: "▲", down: "▼", stable: "→" };
const trendColor: Record<Trend, string> = { up: "#22c55e", down: "#ef4444", stable: "#f59e0b" };

function TickerItem({ p }: { p: CropPriceVM }) {
  const color = trendColor[p.trend];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 20px", whiteSpace: "nowrap" }}>
      <span style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0" }}>{p.crop}</span>
      <span style={{ fontWeight: 800, fontSize: 13, color }}>
        ₹{p.price.toLocaleString("en-IN")}
      </span>
      <span style={{ fontSize: 12, color }}>
        {trendArrow[p.trend]} {p.changePct > 0 ? "+" : ""}{p.changePct.toFixed(1)}%
      </span>
      <span style={{ fontSize: 11, color: "#475569" }}>{p.district}</span>
      <span style={{ color: "#1e293b", fontSize: 13, marginLeft: 8 }}>|</span>
    </span>
  );
}

const PriceTicker: React.FC<PriceTickerProps> = ({
  stateFilter,
  maxItems = 10,
  height = 44,
}) => {
  const { prices, live } = usePrices();
  const tickerRef = React.useRef<HTMLDivElement>(null);

  const items = React.useMemo(() => {
    let out = prices;
    if (stateFilter) out = out.filter(p => p.state === stateFilter);
    return out
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, maxItems);
  }, [prices, stateFilter, maxItems]);

  // CSS marquee via animation — no JS required
  const itemCount = items.length;
  const duration = Math.max(itemCount * 3, 20); // ~3s per item

  return (
    <div style={{
      background: "rgba(11,17,32,0.97)",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      height,
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      {/* Label */}
      <div style={{
        flexShrink: 0,
        padding: "0 14px 0 12px",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        gap: 6,
        height: "100%",
      }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
          color: live ? "#22c55e" : "#f59e0b",
          textTransform: "uppercase",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: live ? "#22c55e" : "#f59e0b",
            animation: "pulse-dot 2s ease-in-out infinite",
          }} />
          {live ? "LIVE" : "DEMO"}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", whiteSpace: "nowrap" }}>
          🌾 Mandi
        </span>
      </div>

      {/* Scrolling items — duplicated to create seamless loop */}
      <div style={{ overflow: "hidden", flex: 1, height: "100%", display: "flex", alignItems: "center" }}>
        <div
          ref={tickerRef}
          style={{
            display: "inline-flex",
            animation: itemCount > 0 ? `ticker-scroll ${duration}s linear infinite` : "none",
            willChange: "transform",
          }}
        >
          {/* Render twice for seamless loop */}
          {[...items, ...items].map((p, i) => (
            <TickerItem key={i} p={p} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PriceTicker;
