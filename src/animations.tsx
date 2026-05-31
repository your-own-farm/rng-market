// ── Animated farmer-friendly primitives ──────────────────────────────────────
// All animation lives in CSS keyframes that are injected once at app boot
// (see <KeyframesGlobal />). Components here are pure visuals — they don't
// depend on i18n or business logic.

import React from "react";
import { GREEN, AMBER, RED, BLUE, MUTED, TEXT, CARD, BORDER } from "./ui";

// ─────────────────────────────────────────────────────────────────────────────
// Global keyframes — mount once, available everywhere.
// ─────────────────────────────────────────────────────────────────────────────
export const KeyframesGlobal: React.FC = () => (
  <style>{`
    @keyframes ki-fade-up   { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes ki-fade-in   { from { opacity: 0; }                              to { opacity: 1; } }
    @keyframes ki-pop       { 0% { transform: scale(.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
    @keyframes ki-bounce    { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
    @keyframes ki-sway      { 0%, 100% { transform: rotate(-3deg); }   50% { transform: rotate(3deg); } }
    @keyframes ki-spin-slow { from { transform: rotate(0); } to { transform: rotate(360deg); } }
    @keyframes ki-drift     { 0% { transform: translateX(-12px); } 50% { transform: translateX(12px); } 100% { transform: translateX(-12px); } }
    @keyframes ki-rain      { 0% { transform: translateY(-22px); opacity: 0; } 50% { opacity: 1; } 100% { transform: translateY(28px); opacity: 0; } }
    @keyframes ki-sparkle   { 0% { transform: scale(0) rotate(0deg); opacity: 0; } 50% { opacity: 1; } 100% { transform: scale(1) rotate(180deg); opacity: 0; } }
    @keyframes ki-shimmer   { 0% { background-position: -300px 0; } 100% { background-position: 300px 0; } }
    @keyframes ki-pulse     { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .55; transform: scale(1.05); } }
    @keyframes ki-grow-bar  { from { width: 0%; } to { width: var(--target, 100%); } }
    @keyframes ki-grow-leaf { 0% { transform: scale(0) translateY(8px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
    @keyframes ki-coin-rise { 0% { transform: translateY(20px); opacity: 0; } 60% { opacity: 1; } 100% { transform: translateY(-32px); opacity: 0; } }

    .ki-anim-fade-up   { animation: ki-fade-up .55s cubic-bezier(.2,.7,.2,1) both; }
    .ki-anim-fade-in   { animation: ki-fade-in .4s ease both; }
    .ki-anim-pop       { animation: ki-pop .5s cubic-bezier(.2,.7,.2,1.4) both; }
    .ki-anim-bounce    { animation: ki-bounce 2.4s ease-in-out infinite; }
    .ki-anim-sway      { animation: ki-sway 4s ease-in-out infinite; transform-origin: 50% 100%; }
    .ki-anim-spin-slow { animation: ki-spin-slow 18s linear infinite; }
    .ki-anim-drift     { animation: ki-drift 7s ease-in-out infinite; }
    .ki-anim-pulse     { animation: ki-pulse 2s ease-in-out infinite; }
    .ki-shimmer {
      background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 100%);
      background-size: 600px 100%;
      animation: ki-shimmer 1.6s linear infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      .ki-anim-fade-up, .ki-anim-fade-in, .ki-anim-pop,
      .ki-anim-bounce, .ki-anim-sway, .ki-anim-spin-slow,
      .ki-anim-drift, .ki-anim-pulse {
        animation: none !important;
      }
    }
  `}</style>
);

// ─────────────────────────────────────────────────────────────────────────────
// AnimatedINR — counts up to a rupee value over ~1s with easeOut.
// ─────────────────────────────────────────────────────────────────────────────
export const AnimatedINR: React.FC<{ value: number; duration?: number; className?: string; style?: React.CSSProperties }> = ({
  value, duration = 1000, className, style,
}) => {
  const [shown, setShown] = React.useState(0);
  const startRef = React.useRef<number>(0);
  const fromRef  = React.useRef<number>(0);

  React.useEffect(() => {
    fromRef.current = shown;
    startRef.current = performance.now();
    let raf = 0;
    const target = value;

    const tick = (t: number) => {
      const p = Math.min(1, (t - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);                  // easeOutCubic
      const next  = Math.round(fromRef.current + (target - fromRef.current) * eased);
      setShown(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <span className={className} style={style}>₹{shown.toLocaleString("en-IN")}</span>;
};

// ─────────────────────────────────────────────────────────────────────────────
// MoodFace — translates a 0..1 score into an emoji and label.
// Easier for a low-literacy farmer to read than "87%".
// ─────────────────────────────────────────────────────────────────────────────
export type MoodTone = "happy" | "ok" | "meh" | "sad";

export interface MoodFaceProps {
  score: number;          // 0..1
  size?: number;
  showLabel?: boolean;
  labels?: Partial<Record<MoodTone, string>>;
}

export function moodFromScore(score: number): MoodTone {
  if (score >= 0.85) return "happy";
  if (score >= 0.70) return "ok";
  if (score >= 0.55) return "meh";
  return "sad";
}

const MOOD_EMOJI: Record<MoodTone, string> = { happy: "😊", ok: "🙂", meh: "😐", sad: "😟" };
const MOOD_COLOR: Record<MoodTone, string> = { happy: GREEN, ok: GREEN, meh: AMBER, sad: RED };

export const MoodFace: React.FC<MoodFaceProps> = ({ score, size = 24, showLabel, labels }) => {
  const tone = moodFromScore(score);
  const color = MOOD_COLOR[tone];
  const label = labels?.[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{
        fontSize: size, lineHeight: 1,
        display: "inline-block", animation: "ki-pop .4s cubic-bezier(.2,.7,.2,1.4) both",
      }}>
        {MOOD_EMOJI[tone]}
      </span>
      {showLabel && label && (
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
      )}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// RaceBar — horizontal "filling" bar used in the profit ranking.
// Grows from 0 → target width when it scrolls into view.
// ─────────────────────────────────────────────────────────────────────────────
export const RaceBar: React.FC<{
  /** Value to display as the bar fill (0..max). */
  value: number;
  /** Max for normalising the bar width (typically the #1's value). */
  max: number;
  /** Optional override of the bar's accent colour. */
  color?: string;
  /** Stagger animation by N ms so successive bars feel sequential. */
  delay?: number;
  height?: number;
  rounded?: boolean;
}> = ({ value, max, color = GREEN, delay = 0, height = 14, rounded = true }) => {
  const pct = Math.max(2, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div style={{
      width: "100%",
      height,
      background: "rgba(255,255,255,0.05)",
      border: `1px solid ${BORDER}`,
      borderRadius: rounded ? height / 2 : 4,
      overflow: "hidden",
      position: "relative",
    }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${color}cc, ${color})`,
          borderRadius: rounded ? height / 2 : 4,
          // CSS variable consumed by ki-grow-bar.
          // @ts-expect-error CSS variables
          "--target": `${pct}%`,
          animation: `ki-grow-bar .9s cubic-bezier(.2,.7,.2,1) ${delay}ms both`,
          boxShadow: `0 0 12px ${color}55`,
        }}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sparkles — burst of tiny ✨ when a result lands.
// Pure CSS, fixed-position over the parent's anchor.
// ─────────────────────────────────────────────────────────────────────────────
export const Sparkles: React.FC<{ count?: number }> = ({ count = 7 }) => {
  const items = React.useMemo(() => {
    return Array.from({ length: count }).map((_, i) => ({
      left:  Math.random() * 100,
      top:   Math.random() * 100,
      delay: Math.random() * 600,
      size:  10 + Math.random() * 10,
    }));
  }, [count]);
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {items.map((it, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${it.left}%`,
            top:  `${it.top}%`,
            fontSize: it.size,
            animation: `ki-sparkle 1.4s ease-out ${it.delay}ms both`,
          }}
        >✨</span>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// GrowingPlant — used while we compute recommendations. Replaces a spinner
// with something contextually fitting.
// ─────────────────────────────────────────────────────────────────────────────
export const GrowingPlant: React.FC<{ text?: string }> = ({ text }) => (
  <div style={{
    background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16,
    padding: "2.5rem 1.5rem", textAlign: "center",
  }}>
    <div style={{ position: "relative", height: 88, marginBottom: 12 }}>
      {/* Stem */}
      <div style={{
        position: "absolute", left: "50%", bottom: 0, width: 3, height: 56,
        background: "linear-gradient(180deg, #16a34a, #064e3b)",
        transformOrigin: "bottom",
        animation: "ki-grow-leaf .9s ease-out both",
        transform: "translateX(-50%)",
        borderRadius: 4,
      }} />
      {/* Left leaf */}
      <div style={{
        position: "absolute", left: "calc(50% - 18px)", bottom: 30,
        width: 22, height: 14, borderRadius: "60% 30% 60% 30%",
        background: "#22c55e",
        animation: "ki-grow-leaf 1s ease-out .3s both, ki-sway 3.5s ease-in-out infinite 1.2s",
        transform: "rotate(-30deg)", transformOrigin: "right center",
      }} />
      {/* Right leaf */}
      <div style={{
        position: "absolute", left: "calc(50% - 4px)", bottom: 42,
        width: 22, height: 14, borderRadius: "30% 60% 30% 60%",
        background: "#34d399",
        animation: "ki-grow-leaf 1s ease-out .5s both, ki-sway 3.5s ease-in-out infinite 1.4s reverse",
        transform: "rotate(30deg)", transformOrigin: "left center",
      }} />
      {/* Top flower */}
      <div style={{
        position: "absolute", left: "50%", bottom: 56,
        fontSize: 24, lineHeight: 1,
        animation: "ki-pop .5s ease-out .8s both, ki-bounce 2.6s ease-in-out infinite 1.4s",
        transform: "translateX(-50%)",
      }}>🌱</div>
      {/* Soil */}
      <div style={{
        position: "absolute", left: "50%", bottom: -2,
        width: 70, height: 8, borderRadius: 6,
        background: "linear-gradient(180deg, #78350f, #451a03)",
        transform: "translateX(-50%)",
      }} />
    </div>
    <div style={{ color: MUTED, fontSize: 13 }}>{text ?? "…"}</div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// HeroIllustration — top-of-page animated mini-scene.
//   Sun rotating, two clouds drifting, raindrops falling, a swaying plant,
//   a rising coin. All inline / CSS. ~3 KB of DOM.
// ─────────────────────────────────────────────────────────────────────────────
export const HeroIllustration: React.FC = () => (
  <div style={{
    position: "relative",
    width: "100%",
    minWidth: 200,
    maxWidth: 320,
    height: 140,
    flex: "0 0 auto",
    pointerEvents: "none",
  }} aria-hidden="true">
    {/* Sun */}
    <div style={{ position: "absolute", top: 8, right: 18 }} className="ki-anim-spin-slow">
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        background: "radial-gradient(circle, #fde68a 0%, #f59e0b 60%, #d97706 100%)",
        boxShadow: "0 0 28px rgba(245,158,11,0.55)",
        position: "relative",
      }}>
        {/* Sun rays */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <span key={deg} style={{
            position: "absolute", left: "50%", top: "50%",
            width: 3, height: 12, marginLeft: -1.5,
            background: "#f59e0b",
            transform: `translateY(-50%) rotate(${deg}deg) translateY(-26px)`,
            borderRadius: 2,
          }} />
        ))}
      </div>
    </div>

    {/* Cloud 1 */}
    <div className="ki-anim-drift" style={{ position: "absolute", top: 18, left: 30, fontSize: 28, animationDuration: "8s" }}>
      ☁️
    </div>
    {/* Cloud 2 (smaller, slower) */}
    <div className="ki-anim-drift" style={{ position: "absolute", top: 50, left: 110, fontSize: 22, animationDuration: "11s", animationDelay: "-3s" }}>
      ☁️
    </div>

    {/* Raindrops */}
    {[40, 60, 80].map((x, i) => (
      <span key={x} style={{
        position: "absolute", left: x, top: 56,
        width: 3, height: 8, borderRadius: 2,
        background: "linear-gradient(180deg, #38bdf8, rgba(56,189,248,0))",
        animation: `ki-rain 1.6s ease-in ${i * 0.4}s infinite`,
      }} />
    ))}

    {/* Plant base + leaves (sways) */}
    <div className="ki-anim-sway" style={{ position: "absolute", left: 50, bottom: 4, transformOrigin: "50% 100%" }}>
      <div style={{ width: 4, height: 38, background: "linear-gradient(180deg, #16a34a, #064e3b)", margin: "0 auto", borderRadius: 4 }} />
      <div style={{ position: "absolute", bottom: 18, left: -14, fontSize: 22 }}>🌿</div>
      <div style={{ position: "absolute", bottom: 26, left: 6,   fontSize: 22 }}>🌱</div>
    </div>
    {/* Soil mound under plant */}
    <div style={{
      position: "absolute", left: 30, bottom: 0,
      width: 60, height: 10, borderRadius: 8,
      background: "linear-gradient(180deg, #78350f, #451a03)",
    }} />

    {/* Rising coins */}
    {[0, 600, 1200].map((delay, i) => (
      <span key={i} style={{
        position: "absolute", left: 140 + i * 14, bottom: 12,
        fontSize: 22,
        animation: `ki-coin-rise 1.8s ease-out ${delay}ms infinite`,
      }}>💰</span>
    ))}

    {/* Ground line */}
    <div style={{
      position: "absolute", left: 8, right: 8, bottom: 0,
      height: 2, borderRadius: 2,
      background: "linear-gradient(90deg, rgba(34,197,94,0) 0%, rgba(34,197,94,0.35) 50%, rgba(34,197,94,0) 100%)",
    }} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// AnimatedWeatherIcon — a small animated icon for each WMO weather code.
// ─────────────────────────────────────────────────────────────────────────────
export const AnimatedWeatherIcon: React.FC<{ code: number; size?: number }> = ({ code, size = 32 }) => {
  if (code === 0) {
    return <span className="ki-anim-spin-slow" style={{ fontSize: size, display: "inline-block" }}>☀️</span>;
  }
  if (code <= 3) {
    return <span className="ki-anim-drift" style={{ fontSize: size, display: "inline-block" }}>⛅</span>;
  }
  if (code <= 67) {
    return <span className="ki-anim-bounce" style={{ fontSize: size, display: "inline-block" }}>🌧️</span>;
  }
  if (code <= 77) {
    return <span className="ki-anim-bounce" style={{ fontSize: size, display: "inline-block" }}>❄️</span>;
  }
  if (code <= 99) {
    return <span className="ki-anim-bounce" style={{ fontSize: size, display: "inline-block" }}>⛈️</span>;
  }
  return <span style={{ fontSize: size }}>🌤️</span>;
};

// ─────────────────────────────────────────────────────────────────────────────
// DemandArrow — quick visual for rising / stable / falling.
// ─────────────────────────────────────────────────────────────────────────────
export const DemandArrow: React.FC<{ direction: "rising" | "stable" | "falling"; label?: string }> = ({ direction, label }) => {
  const map = {
    rising:  { icon: "📈", color: GREEN, arrow: "↑" },
    stable:  { icon: "➡️", color: AMBER, arrow: "→" },
    falling: { icon: "📉", color: RED,   arrow: "↓" },
  } as const;
  const m = map[direction];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 999,
      background: m.color + "18", color: m.color,
      fontSize: 12, fontWeight: 700,
      border: `1px solid ${m.color}40`,
    }}>
      <span>{m.icon}</span>{label && <span>{label}</span>}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// RankMedal — gold / silver / bronze / number for podium positions.
// ─────────────────────────────────────────────────────────────────────────────
export const RankMedal: React.FC<{ rank: number; size?: number }> = ({ rank, size = 32 }) => {
  if (rank === 1) return <span style={{ fontSize: size }}>🥇</span>;
  if (rank === 2) return <span style={{ fontSize: size }}>🥈</span>;
  if (rank === 3) return <span style={{ fontSize: size }}>🥉</span>;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size, height: size, borderRadius: "50%",
      background: "rgba(148,163,184,0.15)", color: "#cbd5e1",
      fontSize: size * 0.45, fontWeight: 800, border: `1px solid ${BORDER}`,
    }}>#{rank}</span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// StarRating — turns a 0..1 confidence into 1–5 stars. Faster for an
// uneducated reader to compare than "78%".
// ─────────────────────────────────────────────────────────────────────────────
export const StarRating: React.FC<{ score: number; size?: number }> = ({ score, size = 13 }) => {
  const stars = Math.round(Math.min(1, Math.max(0, score)) * 5);
  return (
    <span style={{ display: "inline-flex", gap: 1, fontSize: size }} aria-label={`${stars} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ color: i < stars ? "#fbbf24" : "#475569" }}>★</span>
      ))}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// FadeUp — wrap any block to animate on mount with a small stagger.
// ─────────────────────────────────────────────────────────────────────────────
export const FadeUp: React.FC<{ children: React.ReactNode; delay?: number; style?: React.CSSProperties }> = ({ children, delay = 0, style }) => (
  <div className="ki-anim-fade-up" style={{ animationDelay: `${delay}ms`, ...style }}>
    {children}
  </div>
);
