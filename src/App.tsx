// ── Kinsar Intelligence — public, no-login decision engine for farmers ──────
// Top-level shell: tab navigation, language selector, and an online indicator.
// All state stays client-side — nothing requires authentication.

import React from "react";
import { I18nProvider, LOCALES, useI18n, Locale } from "./i18n";
import { usePrices } from "./usePrices";
import DecisionEngine from "./pages/DecisionEngine";
import Weather       from "./pages/Weather";
import Prices        from "./pages/Prices";
import Calculator    from "./pages/Calculator";
import Knowledge     from "./pages/Knowledge";
import {
  Dropdown, DropdownOption,
  BG, CARD, CARD_HI, BORDER, BORDER_HI, GREEN, AMBER, MUTED, TEXT, TEXT_DIM,
} from "./ui";

type TabId = "advisor" | "weather" | "prices" | "calculator" | "knowledge";

const TABS: Array<{ id: TabId; icon: string; key: string }> = [
  { id: "advisor",    icon: "🌱", key: "tab.advisor" },
  { id: "weather",    icon: "🌤", key: "tab.weather" },
  { id: "prices",     icon: "💰", key: "tab.prices" },
  { id: "calculator", icon: "🧮", key: "tab.calculator" },
  { id: "knowledge",  icon: "📚", key: "tab.knowledge" },
];

const ACTIVE_TAB_KEY = "kinsar.activeTab";

// ── Online indicator ──────────────────────────────────────────────────────────
function useOnlineStatus(): boolean {
  const [online, setOnline] = React.useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  React.useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online",  on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

// ── Language selector ─────────────────────────────────────────────────────────
const LanguageSelector: React.FC = () => {
  const { locale, setLocale } = useI18n();
  const opts: DropdownOption[] = LOCALES.map((l) => ({
    value: l.code,
    label: `${l.flag}  ${l.native}`,
  }));
  return (
    <Dropdown
      icon="🌐"
      value={locale}
      options={opts}
      onChange={(v) => setLocale(v as Locale)}
    />
  );
};

// ── Inner app (needs I18nProvider in scope) ──────────────────────────────────
const Inner: React.FC = () => {
  const { t } = useI18n();
  const { prices, live } = usePrices();
  const online = useOnlineStatus();

  const [tab, setTab] = React.useState<TabId>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_TAB_KEY) as TabId | null;
      return saved && TABS.some((tt) => tt.id === saved) ? saved : "advisor";
    } catch { return "advisor"; }
  });

  React.useEffect(() => {
    try { localStorage.setItem(ACTIVE_TAB_KEY, tab); } catch {}
  }, [tab]);

  return (
    <div style={{
      background: BG, minHeight: "100vh", color: TEXT,
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes dd-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        * { box-sizing: border-box; }
        html, body { background: ${BG}; color-scheme: dark; overflow-x: hidden; margin: 0; }
        input[type="search"], input[type="number"] { outline: none; }
        input[type="search"]:focus, input[type="number"]:focus {
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 2px rgba(99,102,241,0.2);
        }
        input[type="search"]::-webkit-search-cancel-button { filter: invert(0.5); }
        a { color: inherit; }
        .kinsar-tab:hover { background: rgba(255,255,255,0.05); }
        .kinsar-tab.active { background: rgba(34,197,94,0.12); color: ${GREEN}; border-color: rgba(34,197,94,0.35); }
        @media (max-width: 640px) {
          .kinsar-header-inner { flex-direction: column; align-items: stretch !important; gap: 0.6rem; }
          .kinsar-tabs { overflow-x: auto; flex-wrap: nowrap !important; }
          .kinsar-tabs::-webkit-scrollbar { height: 0; }
          .kinsar-main { padding: 1rem !important; }
        }
      `}</style>

      {/* ── Header ─── */}
      <header style={{
        borderBottom: `1px solid ${BORDER}`,
        background: "rgba(11,17,32,0.92)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div className="kinsar-header-inner" style={{
          maxWidth: 1280, margin: "0 auto",
          padding: "0.85rem 1.2rem",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>🌾</span>
            <div>
              <h1 style={{ fontSize: "1rem", fontWeight: 800, color: TEXT, lineHeight: 1.1, margin: 0 }}>
                {t("brand.title")}
              </h1>
              <p style={{ fontSize: 11, color: MUTED, margin: "2px 0 0" }}>
                {t("brand.tagline")} · <span style={{ color: AMBER }}>{t("ui.beta")}</span>
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <OnlineBadge online={online} live={live} />
            <LanguageSelector />
          </div>
        </div>

        {/* Tab strip */}
        <div className="kinsar-tabs" style={{
          maxWidth: 1280, margin: "0 auto",
          padding: "0 1.2rem 0.7rem",
          display: "flex", gap: "0.4rem", flexWrap: "wrap",
        }}>
          {TABS.map((tt) => (
            <button
              key={tt.id}
              className={`kinsar-tab ${tab === tt.id ? "active" : ""}`}
              onClick={() => setTab(tt.id)}
              style={{
                padding: "0.55rem 0.95rem",
                background: "transparent",
                border: `1px solid ${BORDER}`,
                borderRadius: 999,
                color: TEXT_DIM,
                fontSize: 13, fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                transition: "background 0.15s, color 0.15s, border-color 0.15s",
              }}
            >
              <span style={{ marginRight: 5 }}>{tt.icon}</span>
              {t(tt.key)}
            </button>
          ))}
        </div>
      </header>

      {/* ── Body ─── */}
      <main className="kinsar-main" style={{ maxWidth: 1280, margin: "0 auto", padding: "1.6rem 1.4rem 3rem" }}>
        {tab === "advisor"    && <DecisionEngine prices={prices} />}
        {tab === "weather"    && <Weather />}
        {tab === "prices"     && <Prices prices={prices} live={live} />}
        {tab === "calculator" && <Calculator prices={prices} />}
        {tab === "knowledge"  && <Knowledge />}
      </main>

      {/* ── Footer ─── */}
      <footer style={{
        borderTop: `1px solid ${BORDER}`,
        padding: "1.4rem 1.2rem",
        textAlign: "center",
      }}>
        <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.7, maxWidth: 720, margin: "0 auto" }}>
          Built on open data: <strong>Open-Meteo</strong> (weather, ODbL) ·{" "}
          <strong>OpenStreetMap Nominatim</strong> (geocoding) ·{" "}
          <strong>SoilGrids by ISRIC</strong> (soil, CC-BY) ·{" "}
          <strong>data.gov.in</strong> (mandi prices).
          <br />
          No login. No tracking. No subscription. Verify recommendations with local agronomists.
        </p>
      </footer>
    </div>
  );
};

// ── Online / live badge ──────────────────────────────────────────────────────
const OnlineBadge: React.FC<{ online: boolean; live: boolean }> = ({ online, live }) => {
  const { t } = useI18n();
  const ok = online;
  const color = ok ? GREEN : AMBER;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 999,
      background: color + "15", border: `1px solid ${color}40`,
      fontSize: 11, fontWeight: 700, color, letterSpacing: "0.04em",
      whiteSpace: "nowrap",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: color,
        animation: ok ? "pulse 2s ease-in-out infinite" : "none",
      }} />
      {ok ? (live ? t("prices.live") : t("ui.connected")) : t("ui.offline")}
    </span>
  );
};

// ── Root export ───────────────────────────────────────────────────────────────
const App: React.FC = () => (
  <I18nProvider>
    <Inner />
  </I18nProvider>
);

export default App;
