// ── Weather page ─────────────────────────────────────────────────────────────
// 7-day forecast for the saved district, plus a sowing-window verdict.

import React from "react";
import { useI18n } from "../i18n";
import { STATES, findState, findDistrict } from "../geo";
import { useWeather, weatherIcon } from "../useWeather";
import {
  Dropdown, DropdownOption, SectionTitle, Pill,
  CARD, CARD_HI, BORDER, GREEN, RED, AMBER, BLUE, MUTED, TEXT, TEXT_DIM,
} from "../ui";
import { AnimatedWeatherIcon, FadeUp } from "../animations";

const STORAGE_KEY = "kinsar.advisor.inputs";

function loadLocation(): { state: string; district: string } {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { state: raw.state || "", district: raw.district || "" };
  } catch { return { state: "", district: "" }; }
}
function saveLocation(state: string, district: string) {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...raw, state, district }));
  } catch {}
}

const Weather: React.FC = () => {
  const { t, locale } = useI18n();
  const init = loadLocation();
  const [stateName, setStateName] = React.useState(init.state);
  const [districtName, setDistrictName] = React.useState(init.district);

  React.useEffect(() => { saveLocation(stateName, districtName); }, [stateName, districtName]);

  const stateObj = stateName ? findState(stateName) : undefined;
  const district = stateName && districtName ? findDistrict(stateName, districtName) : undefined;
  const weather = useWeather(district?.lat ?? null, district?.lng ?? null);

  const stateOptions: DropdownOption[] = STATES.map((s) => ({ value: s.name, label: s.name }));
  const districtOptions: DropdownOption[] = stateObj
    ? stateObj.districts.map((d) => ({ value: d.name, label: d.name }))
    : [];

  // Sowing window verdict
  const verdict: { tone: string; label: string; icon: string } = React.useMemo(() => {
    if (!weather.data) return { tone: MUTED, label: "", icon: "" };
    const w = weather.data;
    if (w.riskScore >= 0.6) return { tone: RED,   label: t("weather.sowing.warning"), icon: "⚠️" };
    if (w.totalRain7d > 200 || w.avgTempMax > 38 || w.avgTempMin < 8)
                            return { tone: AMBER, label: t("weather.sowing.wait"),    icon: "⏳" };
    return                         { tone: GREEN, label: t("weather.sowing.good"),    icon: "✅" };
  }, [weather.data, t]);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(locale === "en" ? "en-IN" : `${locale}-IN`, { weekday: "short", day: "numeric", month: "short" });
  };

  return (
    <div>
      <SectionTitle title={`🌤️ ${t("weather.title")}`} sub={t("weather.sub")} />

      {/* Location picker */}
      <div style={{ display: "grid", gap: "0.7rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: "1.5rem" }}>
        <Dropdown icon="📍" placeholder={t("advisor.state")}    value={stateName}    options={stateOptions}    onChange={(v) => { setStateName(v); setDistrictName(""); }} />
        <Dropdown icon="🏘️" placeholder={t("advisor.district")} value={districtName} options={districtOptions} onChange={setDistrictName} />
      </div>

      {!district ? (
        <div style={{ padding: "2rem", background: CARD, border: `1px dashed ${BORDER}`, borderRadius: 16, color: MUTED, textAlign: "center" }}>
          📍 {t("weather.no.location")}
        </div>
      ) : weather.loading ? (
        <div style={{ padding: "2rem", color: MUTED, textAlign: "center" }}>⏳ {t("weather.loading")}</div>
      ) : weather.data ? (
        <>
          {/* Top summary */}
          <div style={{ display: "grid", gap: "0.8rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: "1.2rem" }}>
            <SummaryTile icon="🌧" label={t("weather.rain.7d")}       value={`${weather.data.totalRain7d.toFixed(0)} mm`} tone={weather.data.totalRain7d > 100 ? BLUE : MUTED} />
            <SummaryTile icon="🌡" label={t("weather.temp.range")}    value={`${weather.data.avgTempMin.toFixed(0)}° – ${weather.data.avgTempMax.toFixed(0)}°C`} tone={TEXT} />
            <SummaryTile icon={verdict.icon} label={t("weather.sowing.window")} value={verdict.label} tone={verdict.tone} />
          </div>

          {/* Daily strip — animated tiles */}
          <div style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
            {weather.data.daily.map((d, i) => (
              <FadeUp key={d.date} delay={i * 50}>
                <div style={{
                  background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12,
                  padding: "0.9rem 0.7rem", textAlign: "center",
                }}>
                  <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    {fmtDate(d.date)}
                  </div>
                  <div style={{ margin: "0.4rem 0", height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <AnimatedWeatherIcon code={d.weatherCode} size={32} />
                  </div>
                  <div style={{ fontSize: 13, color: TEXT, fontWeight: 700 }}>
                    {d.tMax.toFixed(0)}° <span style={{ color: MUTED, fontWeight: 500 }}>/ {d.tMin.toFixed(0)}°</span>
                  </div>
                  {d.rainMm > 1 && (
                    <div style={{ fontSize: 11, color: BLUE, marginTop: 4 }}>💧 {d.rainMm.toFixed(0)} mm</div>
                  )}
                </div>
              </FadeUp>
            ))}
          </div>

          {/* Alerts */}
          {weather.data.totalRain7d > 200 && <Alert tone={BLUE}  icon="🌊" text={t("weather.heavy")} />}
          {weather.data.avgTempMax > 40    && <Alert tone={RED}  icon="🔥" text={t("weather.hot")} />}
          {weather.data.avgTempMin < 5     && <Alert tone={BLUE} icon="❄️" text={t("weather.cold")} />}

          <div style={{ marginTop: "1.2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 12, color: MUTED }}>
              📍 {district.name}, {stateName} · {district.lat.toFixed(2)}°N {district.lng.toFixed(2)}°E
            </span>
            <Pill color={weather.data.source === "open-meteo" ? GREEN : AMBER}>
              {weather.data.source === "open-meteo" ? "Open-Meteo" : t("ui.offline")}
            </Pill>
          </div>
        </>
      ) : null}
    </div>
  );
};

const SummaryTile: React.FC<{ icon: string; label: string; value: string; tone: string }> = ({ icon, label, value, tone }) => (
  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "1rem 1.1rem" }}>
    <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
      {icon} {label}
    </div>
    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: tone, letterSpacing: "-0.02em", marginTop: 4 }}>
      {value}
    </div>
  </div>
);

const Alert: React.FC<{ tone: string; icon: string; text: string }> = ({ tone, icon, text }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 8,
    marginTop: "0.7rem", padding: "0.7rem 1rem",
    background: tone + "10", border: `1px solid ${tone}30`,
    borderRadius: 10, color: tone, fontSize: 13, fontWeight: 700,
  }}>{icon} {text}</div>
);

export default Weather;
