// ── Shared UI primitives ─────────────────────────────────────────────────────
// Tokens + a couple of common components that show up on every page. Keeping
// them here so individual pages stay focused on their own logic.

import React from "react";

// Tokens
export const BG       = "#0b1120";
export const BG_DEEP  = "#070e1a";
export const CARD     = "rgba(255,255,255,0.04)";
export const CARD_HI  = "rgba(255,255,255,0.07)";
export const BORDER   = "rgba(255,255,255,0.08)";
export const BORDER_HI = "rgba(255,255,255,0.14)";
export const GREEN    = "#22c55e";
export const RED      = "#ef4444";
export const AMBER    = "#f59e0b";
export const BLUE     = "#38bdf8";
export const VIOLET   = "#a78bfa";
export const MUTED    = "#64748b";
export const TEXT     = "#f1f5f9";
export const TEXT_DIM = "#94a3b8";

export function formatINR(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

// ── Dropdown ──────────────────────────────────────────────────────────────────
export interface DropdownOption { value: string; label: string; dot?: string }
export interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (v: string) => void;
  icon?: string;
  placeholder?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({ value, options, onChange, icon, placeholder }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", userSelect: "none" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "0.6rem 0.95rem",
          background: open ? "rgba(99,102,241,0.12)" : CARD_HI,
          border: `1px solid ${open ? "rgba(99,102,241,0.5)" : BORDER}`,
          borderRadius: 10, color: TEXT, fontSize: 14, fontWeight: 500,
          cursor: "pointer", whiteSpace: "nowrap", outline: "none",
          transition: "background 0.15s, border-color 0.15s",
          fontFamily: "inherit", minHeight: 42,
        }}
      >
        {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
        {selected?.dot && <span>{selected.dot}</span>}
        <span style={{ color: selected ? "#e2e8f0" : MUTED }}>
          {selected?.label ?? placeholder ?? "Select…"}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ marginLeft: "auto", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
          <path d="M2 4l4 4 4-4" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          minWidth: "100%", zIndex: 200,
          background: "#111827",
          border: `1px solid ${BORDER_HI}`,
          borderRadius: 12,
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
          overflow: "hidden", maxHeight: 320, overflowY: "auto",
          animation: "dd-in 0.12s ease",
        }}>
          {options.map((opt, i) => {
            const active = opt.value === value;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "0.65rem 1rem",
                  background: active ? "rgba(99,102,241,0.15)" : "transparent",
                  border: "none",
                  borderBottom: i < options.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  color: active ? VIOLET : "#cbd5e1",
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  cursor: "pointer", textAlign: "left", whiteSpace: "nowrap",
                  fontFamily: "inherit",
                  transition: "background 0.1s, color 0.1s",
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                {opt.dot && <span style={{ fontSize: 11 }}>{opt.dot}</span>}
                <span style={{ flex: 1 }}>{opt.label}</span>
                {active && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7l3 3 6-6" stroke={VIOLET} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Section heading ──────────────────────────────────────────────────────────
export const SectionTitle: React.FC<{ title: string; sub?: string }> = ({ title, sub }) => (
  <div style={{ marginBottom: "1.5rem" }}>
    <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: TEXT, letterSpacing: "-0.02em", marginBottom: 4 }}>
      {title}
    </h2>
    {sub && <p style={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.6 }}>{sub}</p>}
  </div>
);

// ── Stat row ─────────────────────────────────────────────────────────────────
export const Stat: React.FC<{ label: string; value: string; tone?: "default" | "good" | "bad" | "warn" }> = ({ label, value, tone = "default" }) => {
  const color = tone === "good" ? GREEN : tone === "bad" ? RED : tone === "warn" ? AMBER : TEXT;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0.4rem 0", borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 13, color: MUTED }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color }}>{value}</span>
    </div>
  );
};

// ── Pill ─────────────────────────────────────────────────────────────────────
export const Pill: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = MUTED }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "3px 9px", borderRadius: 999,
    background: color + "20", color, fontSize: 11, fontWeight: 700,
    letterSpacing: "0.04em", textTransform: "uppercase",
    border: `1px solid ${color}30`,
  }}>
    {children}
  </span>
);
