// ── Knowledge / Help / Schemes ───────────────────────────────────────────────
// Static reference list of Govt-of-India schemes + public helplines every
// farmer should know about. All content is from official public sources.

import React from "react";
import { useI18n } from "../i18n";
import { CROPS, cropName } from "../crops";
import {
  SectionTitle, Pill,
  CARD, CARD_HI, BORDER, GREEN, BLUE, AMBER, VIOLET, MUTED, TEXT, TEXT_DIM,
} from "../ui";

interface Scheme {
  name: string;
  short: string;
  url: string;
  benefit: string;
  audience: string;
  tone: string;
}

const SCHEMES: Scheme[] = [
  {
    name: "PM-Kisan Samman Nidhi",
    short: "PM-KISAN",
    url: "https://pmkisan.gov.in",
    benefit: "₹6,000/year direct cash transfer to small/marginal farmers (3 instalments)",
    audience: "Land-holding farmer families",
    tone: GREEN,
  },
  {
    name: "PM Fasal Bima Yojana",
    short: "PMFBY",
    url: "https://pmfby.gov.in",
    benefit: "Crop insurance — 2% premium (Kharif), 1.5% (Rabi) on sum insured",
    audience: "All farmers growing notified crops",
    tone: BLUE,
  },
  {
    name: "Kisan Credit Card",
    short: "KCC",
    url: "https://www.myscheme.gov.in/schemes/kcc",
    benefit: "Short-term loan up to ₹3 lakh at 4% effective interest with subvention",
    audience: "All farmers including tenants and sharecroppers",
    tone: VIOLET,
  },
  {
    name: "Soil Health Card",
    short: "SHC",
    url: "https://soilhealth.dac.gov.in",
    benefit: "Free soil testing + fertiliser advice every 2 years",
    audience: "Every land-owning farmer",
    tone: AMBER,
  },
  {
    name: "eNAM (National Agriculture Market)",
    short: "eNAM",
    url: "https://enam.gov.in",
    benefit: "Online trading platform — sell beyond your local mandi to higher bidders",
    audience: "Farmers registered with any of 1,000+ linked mandis",
    tone: GREEN,
  },
  {
    name: "PM Krishi Sinchayee Yojana",
    short: "PMKSY",
    url: "https://pmksy.gov.in",
    benefit: "Subsidy on drip/sprinkler irrigation — up to 55% for small farmers",
    audience: "All farmers",
    tone: BLUE,
  },
  {
    name: "MSP Procurement (FCI)",
    short: "MSP",
    url: "https://fci.gov.in",
    benefit: "Minimum Support Price for 23 crops — guaranteed floor",
    audience: "Wheat, paddy, pulses, oilseeds, cotton growers",
    tone: AMBER,
  },
];

interface Helpline {
  name: string;
  number: string;
  hours: string;
}

const HELPLINES: Helpline[] = [
  { name: "Kisan Call Centre",           number: "1800-180-1551", hours: "6 AM – 10 PM, all India, 22 languages" },
  { name: "PM-Kisan Helpline",           number: "155261",        hours: "Working hours" },
  { name: "Crop Insurance (PMFBY)",      number: "14447",         hours: "24×7" },
  { name: "Animal Husbandry Helpline",   number: "1962",          hours: "24×7 mobile vet" },
  { name: "IMD Weather (Doordarshan)",   number: "1800-180-1717", hours: "Free agro-met advisory" },
];

const Knowledge: React.FC = () => {
  const { t, locale } = useI18n();

  return (
    <div>
      <SectionTitle title={`📚 ${t("kb.title")}`} sub={t("kb.sub")} />

      {/* Schemes */}
      <Block title={t("kb.schemes")} icon="🏛">
        <div style={{ display: "grid", gap: "0.8rem", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {SCHEMES.map((s) => (
            <a key={s.short} href={s.url} target="_blank" rel="noopener noreferrer" style={schemeCard(s.tone)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <div style={{ fontSize: "1.02rem", fontWeight: 800, color: TEXT, lineHeight: 1.2 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 2 }}>{s.short}</div>
                </div>
                <Pill color={s.tone}>Active</Pill>
              </div>
              <p style={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.55, margin: "0.6rem 0 0.4rem" }}>{s.benefit}</p>
              <div style={{ fontSize: 11, color: MUTED }}>{s.audience}</div>
              <div style={{ fontSize: 11, color: s.tone, marginTop: "0.5rem", fontWeight: 700 }}>{s.url.replace("https://", "")} ↗</div>
            </a>
          ))}
        </div>
      </Block>

      {/* Helplines */}
      <Block title={t("kb.helplines")} icon="☎️">
        <div style={{ display: "grid", gap: "0.7rem", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {HELPLINES.map((h) => (
            <a key={h.number} href={`tel:${h.number.replace(/-/g, "")}`} style={helplineCard()}>
              <div style={{ fontSize: 12, color: MUTED, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h.name}</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: GREEN, letterSpacing: "-0.02em", margin: "0.2rem 0" }}>📞 {h.number}</div>
              <div style={{ fontSize: 12, color: TEXT_DIM }}>{h.hours}</div>
            </a>
          ))}
        </div>
      </Block>

      {/* Pests */}
      <Block title={t("kb.pests")} icon="🐛">
        <div style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {CROPS.map((c) => (
            <div key={c.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0.85rem 1rem" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 4 }}>
                {c.emoji} {cropName(c, locale)}
              </div>
              <div style={{ fontSize: 12, color: TEXT_DIM, lineHeight: 1.5 }}>
                {c.pests.join(" · ")}
              </div>
            </div>
          ))}
        </div>
      </Block>

      <p style={{ fontSize: 12, color: MUTED, textAlign: "center", marginTop: "2rem", lineHeight: 1.6, fontStyle: "italic" }}>
        {t("kb.disclaimer")}
      </p>
    </div>
  );
};

const Block: React.FC<{ title: string; icon: string; children: React.ReactNode }> = ({ title, icon, children }) => (
  <section style={{ marginBottom: "2rem" }}>
    <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: TEXT, marginBottom: "0.8rem", display: "flex", alignItems: "center", gap: 8 }}>
      <span>{icon}</span>
      <span>{title}</span>
    </h3>
    {children}
  </section>
);

const schemeCard = (tone: string): React.CSSProperties => ({
  display: "block",
  background: CARD, border: `1px solid ${BORDER}`,
  borderLeft: `3px solid ${tone}`,
  borderRadius: 12, padding: "1rem 1.1rem",
  textDecoration: "none", color: "inherit",
  transition: "background 0.15s, border-color 0.15s",
});

const helplineCard = (): React.CSSProperties => ({
  display: "block",
  background: CARD, border: `1px solid ${BORDER}`,
  borderRadius: 12, padding: "0.95rem 1.1rem",
  textDecoration: "none", color: "inherit",
});

export default Knowledge;
