// ── Firebase Realtime Database schema ────────────────────────────────────────
//
// /crop-prices
//   /{stateKey}             e.g. "maharashtra"
//     /{districtKey}        e.g. "nashik"
//       /{cropKey}          e.g. "tomato"
//         price:       number   — current modal price (₹ per quintal)
//         prevPrice:   number   — yesterday's modal price
//         unit:        string   — "quintal" | "kg" | "dozen"
//         market:      string   — APMC market name
//         updatedAt:   number   — Unix ms timestamp
//         state:       string   — display name e.g. "Maharashtra"
//         district:    string   — display name e.g. "Nashik"
//         crop:        string   — display name e.g. "Tomato"

export interface CropPrice {
  crop:       string;
  state:      string;
  district:   string;
  market:     string;
  price:      number;
  prevPrice:  number;
  unit:       string;
  updatedAt:  number;
}

export type Trend = "up" | "down" | "stable";

export interface CropPriceVM extends CropPrice {
  trend:       Trend;
  changePct:   number;   // signed %
  advice:      SellAdvice;
}

export type SellAdvice = "sell-now" | "hold" | "watch";

// ── Sell-timing heuristic ─────────────────────────────────────────────────────
// Simple momentum rule — real logic should come from a backend service
export function deriveAdvice(vm: Pick<CropPriceVM, "trend" | "changePct">): SellAdvice {
  if (vm.trend === "up"   && vm.changePct >= 5)  return "sell-now";
  if (vm.trend === "down" && vm.changePct <= -3) return "hold";
  return "watch";
}

export function toVM(p: CropPrice): CropPriceVM {
  const changePct = p.prevPrice > 0
    ? ((p.price - p.prevPrice) / p.prevPrice) * 100
    : 0;
  const trend: Trend = changePct > 0.5 ? "up" : changePct < -0.5 ? "down" : "stable";
  const vm = { ...p, trend, changePct };
  return { ...vm, advice: deriveAdvice(vm) };
}

// ── Seed / demo data (used when Realtime DB is empty or unreachable) ──────────
export const DEMO_PRICES: CropPrice[] = [
  { crop: "Tomato",     state: "Maharashtra", district: "Nashik",    market: "Lasalgaon APMC", price: 1840, prevPrice: 1520, unit: "quintal", updatedAt: Date.now() - 5*60*1000  },
  { crop: "Onion",      state: "Maharashtra", district: "Nashik",    market: "Lasalgaon APMC", price: 1260, prevPrice: 1310, unit: "quintal", updatedAt: Date.now() - 8*60*1000  },
  { crop: "Potato",     state: "Uttar Pradesh", district: "Agra",    market: "Agra APMC",      price: 980,  prevPrice: 950,  unit: "quintal", updatedAt: Date.now() - 3*60*1000  },
  { crop: "Rice",       state: "Punjab",      district: "Amritsar",  market: "Amritsar Mandi", price: 2180, prevPrice: 2120, unit: "quintal", updatedAt: Date.now() - 12*60*1000 },
  { crop: "Wheat",      state: "Punjab",      district: "Ludhiana",  market: "Ludhiana Mandi", price: 2350, prevPrice: 2400, unit: "quintal", updatedAt: Date.now() - 7*60*1000  },
  { crop: "Soybean",    state: "Madhya Pradesh", district: "Indore", market: "Indore Mandi",   price: 4820, prevPrice: 4750, unit: "quintal", updatedAt: Date.now() - 15*60*1000 },
  { crop: "Cotton",     state: "Gujarat",     district: "Ahmedabad", market: "Ahmedabad APMC", price: 6400, prevPrice: 6200, unit: "quintal", updatedAt: Date.now() - 20*60*1000 },
  { crop: "Sugarcane",  state: "Maharashtra", district: "Pune",      market: "Pune APMC",      price: 315,  prevPrice: 315,  unit: "quintal", updatedAt: Date.now() - 30*60*1000 },
  { crop: "Maize",      state: "Karnataka",   district: "Davangere", market: "Davangere APMC", price: 1890, prevPrice: 1820, unit: "quintal", updatedAt: Date.now() - 10*60*1000 },
  { crop: "Chilli",     state: "Andhra Pradesh", district: "Guntur", market: "Guntur APMC",    price: 9200, prevPrice: 9800, unit: "quintal", updatedAt: Date.now() - 6*60*1000  },
  { crop: "Banana",     state: "Tamil Nadu",  district: "Trichy",    market: "Trichy APMC",    price: 1250, prevPrice: 1200, unit: "quintal", updatedAt: Date.now() - 4*60*1000  },
  { crop: "Groundnut",  state: "Gujarat",     district: "Junagadh",  market: "Junagadh APMC",  price: 5800, prevPrice: 5650, unit: "quintal", updatedAt: Date.now() - 18*60*1000 },
];
