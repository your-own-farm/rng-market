// ── Crop knowledge base ──────────────────────────────────────────────────────
// Source-of-truth for the recommender engine. Numbers are conservative averages
// drawn from public IARI / ICAR / state agriculture department bulletins.
// Yields are quintals/acre, costs are ₹/acre.
//
// Bundled offline so the app works on 2G / patchy connectivity.

import { Locale } from "./i18n";

export type SoilType =
  | "alluvial"
  | "black"
  | "red"
  | "laterite"
  | "sandy"
  | "loamy"
  | "clay";

export type Season = "kharif" | "rabi" | "zaid";
export type Water = "low" | "medium" | "high";
export type NutrientLevel = "low" | "medium" | "high";

export interface CropKB {
  id: string;
  emoji: string;
  /** Display names — fall back to en if a language is missing. */
  names: Partial<Record<Locale, string>> & { en: string };
  seasons: Season[];
  /** Months when sowing is typical (1 = Jan … 12 = Dec). */
  sowingMonths: number[];
  daysToHarvest: number;
  soils: SoilType[];
  waterNeed: Water;
  yieldQtlPerAcre: { low: number; avg: number; high: number };
  /** Input cost per acre (₹). organic is usually higher upfront, lower long-term. */
  inputCost: { organic: number; urea: number };
  /** Indicative MSP / wholesale base (₹/quintal). Overridden by live mandi data when available. */
  baseFloorPrice: number;
  /** Crop's typical demand momentum across last 3y. -1 falling, 0 stable, +1 rising. */
  demandTrend: -1 | 0 | 1;
  /** Free-text key reasons shown in "Why this crop?" */
  notes: Partial<Record<Locale, string[]>> & { en: string[] };
  /** Common pests (i18n-light; English only) */
  pests: string[];
  /** Nutrient demand profile — used to grade soil-vs-crop NPK fit. */
  nutrientNeed: { n: NutrientLevel; p: NutrientLevel; k: NutrientLevel };
  /** Acceptable soil pH window (inclusive). */
  phRange: [number, number];
  /** Approximate organic-vs-chemical yield ratio (0..1.05). Most studies put
   *  it at 0.85–0.95 in the first cycle; some legumes are near-parity. */
  organicYieldRatio: number;
}

// ── Catalog ───────────────────────────────────────────────────────────────────
export const CROPS: CropKB[] = [
  {
    id: "tomato",
    emoji: "🍅",
    names: { en: "Tomato", hi: "टमाटर", mr: "टोमॅटो", ta: "தக்காளி" },
    seasons: ["kharif", "rabi", "zaid"],
    sowingMonths: [6, 7, 10, 11, 1, 2],
    daysToHarvest: 90,
    soils: ["loamy", "alluvial", "red"],
    waterNeed: "medium",
    yieldQtlPerAcre: { low: 80, avg: 140, high: 220 },
    inputCost: { organic: 32000, urea: 24000 },
    baseFloorPrice: 1500,
    demandTrend: 1,
    notes: {
      en: [
        "Quick 3-month cycle → 3 harvests possible per year.",
        "Drip irrigation cuts water use 40% and raises yield.",
        "Watch for fruit-borer and whitefly during flowering.",
      ],
      hi: [
        "3 महीने का चक्र → साल में 3 फसलें संभव।",
        "ड्रिप सिंचाई से 40% पानी बचत।",
        "फूल आते समय फल-छेदक से बचाव करें।",
      ],
      mr: [
        "3 महिन्यांचा चक्र → वर्षात 3 पिकं शक्य.",
        "ठिबक सिंचनाने 40% पाणी बचत.",
        "फुलधारणेच्या वेळी फळपोखरणारी अळी टाळा.",
      ],
    },
    pests: ["Fruit borer", "Whitefly", "Leaf curl virus"],
    nutrientNeed: { n: "high",   p: "high",   k: "high"   },
    phRange: [6.0, 7.0],
    organicYieldRatio: 0.88,
  },
  {
    id: "onion",
    emoji: "🧅",
    names: { en: "Onion", hi: "प्याज़", mr: "कांदा", ta: "வெங்காயம்" },
    seasons: ["kharif", "rabi"],
    sowingMonths: [6, 7, 10, 11],
    daysToHarvest: 120,
    soils: ["loamy", "alluvial", "red"],
    waterNeed: "medium",
    yieldQtlPerAcre: { low: 100, avg: 160, high: 250 },
    inputCost: { organic: 28000, urea: 22000 },
    baseFloorPrice: 1200,
    demandTrend: 1,
    notes: {
      en: [
        "Stores 3–6 months — buffer against price crashes.",
        "Best returns in Maharashtra (Lasalgaon), Karnataka.",
      ],
      hi: ["3–6 महीने भंडारण → भाव गिरने से बचाव।", "नासिक, सोलापुर में अच्छी कीमत।"],
      mr: ["3–6 महिने साठवण शक्य.", "नाशिक, सोलापूरमध्ये चांगला भाव."],
    },
    pests: ["Thrips", "Purple blotch"],
    nutrientNeed: { n: "medium", p: "high",   k: "high"   },
    phRange: [6.0, 7.5],
    organicYieldRatio: 0.90,
  },
  {
    id: "potato",
    emoji: "🥔",
    names: { en: "Potato", hi: "आलू", mr: "बटाटा", ta: "உருளைக்கிழங்கு" },
    seasons: ["rabi"],
    sowingMonths: [10, 11, 12],
    daysToHarvest: 100,
    soils: ["alluvial", "loamy", "sandy"],
    waterNeed: "medium",
    yieldQtlPerAcre: { low: 100, avg: 180, high: 280 },
    inputCost: { organic: 30000, urea: 24000 },
    baseFloorPrice: 950,
    demandTrend: 0,
    notes: {
      en: [
        "UP, West Bengal, Bihar dominate — high competition.",
        "Cold storage essential; without it, sell within 30 days.",
      ],
      hi: ["यूपी, बंगाल में ज़्यादा मुकाबला।", "कोल्ड स्टोरेज न हो तो 30 दिन में बेचें।"],
    },
    pests: ["Late blight", "Tuber moth"],
    nutrientNeed: { n: "high",   p: "medium", k: "high"   },
    phRange: [5.0, 6.5],
    organicYieldRatio: 0.85,
  },
  {
    id: "rice",
    emoji: "🌾",
    names: { en: "Rice", hi: "धान", mr: "तांदूळ", ta: "நெல்" },
    seasons: ["kharif", "zaid"],
    sowingMonths: [6, 7, 12, 1],
    daysToHarvest: 130,
    soils: ["alluvial", "clay", "loamy"],
    waterNeed: "high",
    yieldQtlPerAcre: { low: 18, avg: 24, high: 32 },
    inputCost: { organic: 18000, urea: 15000 },
    baseFloorPrice: 2183,
    demandTrend: 0,
    notes: {
      en: [
        "MSP-backed — guaranteed floor price from FCI.",
        "Water-intensive — only for areas with assured irrigation.",
      ],
      hi: ["FCI से एमएसपी की गारंटी।", "पानी ज़्यादा चाहिए — सिंचाई पक्की हो।"],
    },
    pests: ["Stem borer", "Brown plant-hopper"],
    nutrientNeed: { n: "high",   p: "medium", k: "medium" },
    phRange: [5.5, 7.0],
    organicYieldRatio: 0.87,
  },
  {
    id: "wheat",
    emoji: "🌾",
    names: { en: "Wheat", hi: "गेहूँ", mr: "गहू", ta: "கோதுமை" },
    seasons: ["rabi"],
    sowingMonths: [11, 12],
    daysToHarvest: 145,
    soils: ["alluvial", "loamy", "black"],
    waterNeed: "medium",
    yieldQtlPerAcre: { low: 16, avg: 22, high: 28 },
    inputCost: { organic: 17000, urea: 14000 },
    baseFloorPrice: 2275,
    demandTrend: 0,
    notes: {
      en: ["MSP procurement strong in Punjab, Haryana, MP.", "Frost risk in late January."],
      hi: ["पंजाब, हरियाणा, एमपी में एमएसपी पर खरीद।", "जनवरी अंत में पाला से सावधान।"],
    },
    pests: ["Aphid", "Rust"],
    nutrientNeed: { n: "high",   p: "medium", k: "medium" },
    phRange: [6.0, 7.5],
    organicYieldRatio: 0.86,
  },
  {
    id: "soybean",
    emoji: "🫘",
    names: { en: "Soybean", hi: "सोयाबीन", mr: "सोयाबीन", ta: "சோயா" },
    seasons: ["kharif"],
    sowingMonths: [6, 7],
    daysToHarvest: 100,
    soils: ["black", "loamy"],
    waterNeed: "low",
    yieldQtlPerAcre: { low: 8, avg: 12, high: 18 },
    inputCost: { organic: 14000, urea: 12000 },
    baseFloorPrice: 4892,
    demandTrend: 1,
    notes: {
      en: ["MP, Maharashtra are main growers.", "Drought-tolerant — needs only 4 irrigations."],
      hi: ["एमपी, महाराष्ट्र में मुख्य।", "सूखा सहनशील — सिर्फ़ 4 बार सिंचाई।"],
      mr: ["मध्य प्रदेश, महाराष्ट्रात प्रमुख.", "दुष्काळसहिष्णू."],
    },
    pests: ["Girdle beetle", "Stem fly"],
    /* Legume — fixes its own nitrogen. */
    nutrientNeed: { n: "low",    p: "medium", k: "medium" },
    phRange: [6.0, 7.5],
    organicYieldRatio: 0.94,
  },
  {
    id: "cotton",
    emoji: "🌱",
    names: { en: "Cotton", hi: "कपास", mr: "कापूस", ta: "பருத்தி" },
    seasons: ["kharif"],
    sowingMonths: [5, 6, 7],
    daysToHarvest: 180,
    soils: ["black", "alluvial"],
    waterNeed: "medium",
    yieldQtlPerAcre: { low: 6, avg: 10, high: 16 },
    inputCost: { organic: 26000, urea: 22000 },
    baseFloorPrice: 7121,
    demandTrend: 1,
    notes: {
      en: ["Long 6-month cycle — locks land for one season.", "Pink bollworm is the biggest threat."],
      hi: ["6 महीने का चक्र।", "गुलाबी सुंडी सबसे बड़ा खतरा।"],
      mr: ["6 महिन्यांचा कालावधी.", "गुलाबी बोंडआळी सर्वात मोठा धोका."],
    },
    pests: ["Pink bollworm", "Whitefly"],
    nutrientNeed: { n: "high",   p: "high",   k: "high"   },
    phRange: [5.8, 8.0],
    organicYieldRatio: 0.82,
  },
  {
    id: "maize",
    emoji: "🌽",
    names: { en: "Maize", hi: "मक्का", mr: "मका", ta: "சோளம்" },
    seasons: ["kharif", "rabi"],
    sowingMonths: [6, 7, 10, 11],
    daysToHarvest: 110,
    soils: ["alluvial", "loamy", "red"],
    waterNeed: "medium",
    yieldQtlPerAcre: { low: 18, avg: 25, high: 35 },
    inputCost: { organic: 16000, urea: 13000 },
    baseFloorPrice: 2225,
    demandTrend: 1,
    notes: {
      en: ["Demand rising — poultry & ethanol feedstock.", "Tolerates moderate rainfall."],
      hi: ["मांग बढ़ रही — मुर्गी पालन और इथेनॉल।", "मध्यम बारिश में भी ठीक।"],
    },
    pests: ["Fall armyworm", "Stem borer"],
    nutrientNeed: { n: "high",   p: "high",   k: "medium" },
    phRange: [5.5, 7.5],
    organicYieldRatio: 0.85,
  },
  {
    id: "groundnut",
    emoji: "🥜",
    names: { en: "Groundnut", hi: "मूँगफली", mr: "भुईमूग", ta: "நிலக்கடலை" },
    seasons: ["kharif", "rabi"],
    sowingMonths: [6, 7, 11, 12],
    daysToHarvest: 110,
    soils: ["sandy", "red", "loamy"],
    waterNeed: "low",
    yieldQtlPerAcre: { low: 10, avg: 16, high: 24 },
    inputCost: { organic: 20000, urea: 16000 },
    baseFloorPrice: 6377,
    demandTrend: 1,
    notes: {
      en: ["Gujarat, Andhra dominate.", "Drought-tolerant; sandy soil ideal."],
      hi: ["गुजरात, आंध्र में मुख्य।", "रेतीली ज़मीन में अच्छा।"],
    },
    pests: ["Leaf miner", "Aphid"],
    /* Legume — light on nitrogen. */
    nutrientNeed: { n: "low",    p: "high",   k: "medium" },
    phRange: [6.0, 7.5],
    organicYieldRatio: 0.92,
  },
  {
    id: "chilli",
    emoji: "🌶️",
    names: { en: "Chilli", hi: "मिर्च", mr: "मिरची", ta: "மிளகாய்" },
    seasons: ["kharif", "rabi"],
    sowingMonths: [6, 7, 10, 11],
    daysToHarvest: 150,
    soils: ["loamy", "red", "alluvial"],
    waterNeed: "medium",
    yieldQtlPerAcre: { low: 8, avg: 14, high: 22 },
    inputCost: { organic: 38000, urea: 32000 },
    baseFloorPrice: 8500,
    demandTrend: 1,
    notes: {
      en: [
        "High-value crop, export potential (Guntur).",
        "Dry chilli stores 8–12 months — flexible selling window.",
      ],
      hi: ["गुंटूर से निर्यात की संभावना।", "सूखी मिर्च 8–12 महीने रखी जा सकती है।"],
      ta: ["குண்டூரிலிருந்து ஏற்றுமதி வாய்ப்பு.", "உலர்ந்த மிளகாய் 8–12 மாதம் சேமிக்கலாம்."],
    },
    pests: ["Thrips", "Mite"],
    nutrientNeed: { n: "high",   p: "high",   k: "high"   },
    phRange: [6.0, 7.5],
    organicYieldRatio: 0.85,
  },
  {
    id: "sugarcane",
    emoji: "🎋",
    names: { en: "Sugarcane", hi: "गन्ना", mr: "ऊस", ta: "கரும்பு" },
    seasons: ["kharif", "rabi"],
    sowingMonths: [10, 11, 12, 2, 3],
    daysToHarvest: 360,
    soils: ["alluvial", "loamy", "black"],
    waterNeed: "high",
    yieldQtlPerAcre: { low: 250, avg: 350, high: 500 },
    inputCost: { organic: 45000, urea: 38000 },
    baseFloorPrice: 340,
    demandTrend: 0,
    notes: {
      en: [
        "12-month crop — long land lock-in.",
        "Sugar mills pay FRP — guaranteed. Watch for late payments.",
      ],
      hi: ["12 महीने का चक्र — ज़मीन लंबे समय फँसती है।", "FRP की गारंटी।"],
      mr: ["12 महिन्यांचं पीक.", "FRP हमी आहे, पण उशिरा पेमेंट सामान्य."],
    },
    pests: ["Early shoot borer", "Whitefly"],
    nutrientNeed: { n: "high",   p: "medium", k: "high"   },
    phRange: [6.0, 7.5],
    organicYieldRatio: 0.83,
  },
  {
    id: "banana",
    emoji: "🍌",
    names: { en: "Banana", hi: "केला", mr: "केळी", ta: "வாழைப்பழம்" },
    seasons: ["kharif", "rabi", "zaid"],
    sowingMonths: [2, 3, 6, 7, 10, 11],
    daysToHarvest: 330,
    soils: ["alluvial", "loamy"],
    waterNeed: "high",
    yieldQtlPerAcre: { low: 200, avg: 350, high: 500 },
    inputCost: { organic: 60000, urea: 50000 },
    baseFloorPrice: 1100,
    demandTrend: 1,
    notes: {
      en: ["High capital — but high return.", "Tamil Nadu (Trichy), Maharashtra (Jalgaon) lead."],
      hi: ["ज़्यादा निवेश, ज़्यादा कमाई।", "जलगाँव, त्रिची मुख्य क्षेत्र।"],
      ta: ["அதிக முதலீடு, அதிக வருமானம்.", "திருச்சி, ஜல்கான் முக்கிய பகுதி."],
    },
    pests: ["Sigatoka leaf spot", "Banana weevil"],
    nutrientNeed: { n: "high",   p: "high",   k: "high"   },
    phRange: [6.0, 7.5],
    organicYieldRatio: 0.86,
  },
  {
    id: "turmeric",
    emoji: "🌿",
    names: { en: "Turmeric", hi: "हल्दी", mr: "हळद", ta: "மஞ்சள்" },
    seasons: ["kharif"],
    sowingMonths: [5, 6, 7],
    daysToHarvest: 270,
    soils: ["loamy", "alluvial", "red"],
    waterNeed: "medium",
    yieldQtlPerAcre: { low: 15, avg: 25, high: 40 },
    inputCost: { organic: 35000, urea: 30000 },
    baseFloorPrice: 7800,
    demandTrend: 1,
    notes: {
      en: ["Export demand strong (US, EU).", "Stores dry up to 24 months."],
      hi: ["यूएस, ईयू में निर्यात मांग।", "24 महीने तक भंडारण।"],
    },
    pests: ["Rhizome rot", "Leaf spot"],
    nutrientNeed: { n: "medium", p: "high",   k: "high"   },
    phRange: [5.5, 7.5],
    organicYieldRatio: 0.93,
  },
  {
    id: "moong",
    emoji: "🟢",
    names: { en: "Moong (Green gram)", hi: "मूँग", mr: "मूग", ta: "பாசிப்பயறு" },
    seasons: ["kharif", "zaid"],
    sowingMonths: [3, 4, 6, 7],
    daysToHarvest: 75,
    soils: ["loamy", "sandy", "red", "black"],
    waterNeed: "low",
    yieldQtlPerAcre: { low: 4, avg: 7, high: 10 },
    inputCost: { organic: 10000, urea: 8000 },
    baseFloorPrice: 8682,
    demandTrend: 1,
    notes: {
      en: [
        "Fast 75-day cycle — great as zaid catch-crop.",
        "Fixes nitrogen → improves soil for next season.",
      ],
      hi: ["75 दिन में तैयार — ज़ायद के लिए बेहतरीन।", "मिट्टी में नाइट्रोजन बढ़ाता है।"],
    },
    pests: ["Yellow mosaic virus", "Whitefly"],
    /* Legume — fixes nitrogen. */
    nutrientNeed: { n: "low",    p: "medium", k: "medium" },
    phRange: [6.2, 7.5],
    organicYieldRatio: 0.95,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function cropName(c: CropKB, locale: Locale): string {
  return c.names[locale] ?? c.names.en;
}

export function cropNotes(c: CropKB, locale: Locale): string[] {
  return c.notes[locale] ?? c.notes.en;
}

export function currentSeason(date: Date = new Date()): Season {
  const m = date.getMonth() + 1;
  if (m >= 6 && m <= 10) return "kharif";
  if (m === 11 || m === 12 || m <= 3) return "rabi";
  return "zaid";
}

export function findCrop(id: string): CropKB | undefined {
  return CROPS.find((c) => c.id === id);
}
