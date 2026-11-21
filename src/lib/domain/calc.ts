import type {
  LineItem,
  LineUnit,
  Macros,
  Offer,
  PriceTier,
  Product,
} from "./types";

type PricedProduct = Pick<
  Product,
  | "baseUnit"
  | "packageSize"
  | "pieces"
  | "pieceSize"
  | "priceBasis"
  | "price"
  | "offers"
  | "nutrition"
>;

export const TIERS: PriceTier[] = ["regular", "member"];

const EPS = 1e-9;

export function isOfferActive(offer: Offer, now = Date.now()): boolean {
  if (!offer.validUntil) return true;
  return new Date(offer.validUntil).getTime() >= now;
}

/**
 * The best price (in the product's price basis) available for a tier.
 * Members get the best of general and member offers; everyone else only general ones.
 * When `quantityBought` is given, multi-buy offers only count if the quantity qualifies.
 */
export function effectivePrice(
  product: Pick<PricedProduct, "price" | "offers">,
  tier: PriceTier,
  quantityBought?: number,
  now = Date.now(),
): { price: number; offer: Offer | null } {
  let best = { price: product.price, offer: null as Offer | null };
  for (const offer of product.offers) {
    if (offer.price == null || !isOfferActive(offer, now)) continue;
    if (offer.memberOnly && tier !== "member") continue;
    if (quantityBought !== undefined && quantityBought + EPS < offer.minQuantity) continue;
    if (offer.price < best.price - EPS) best = { price: offer.price, offer };
  }
  return best;
}

const VOLUME_ML: Partial<Record<LineUnit, number>> = { ml: 1, dl: 100, l: 1000 };
const WEIGHT_G: Partial<Record<LineUnit, number>> = { g: 1, kg: 1000 };

export interface LineAmount {
  /** Amount in the product's base unit (g or ml). */
  amount: number | null;
  /** Fraction of packages used. */
  packages: number | null;
  /** True when a weight/volume conversion assumed a density of 1 g/ml. */
  approx: boolean;
}

/** Weight (in baseUnit) of one "st" of the product, when known. */
export function pieceAmount(product: PricedProduct): number | null {
  if (product.pieceSize) return product.pieceSize;
  if (product.packageSize == null) return null;
  return product.pieces ? product.packageSize / product.pieces : product.packageSize;
}

export function resolveAmount(product: PricedProduct, line: Pick<LineItem, "quantity" | "unit">): LineAmount {
  const { quantity, unit } = line;
  const size = product.packageSize;
  let approx = false;
  let amount: number | null;
  let packages: number | null;

  if (unit === "pkg") {
    packages = quantity;
    amount = size != null ? quantity * size : null;
  } else if (unit === "st") {
    const piece = pieceAmount(product);
    amount = piece != null ? quantity * piece : null;
    if (amount != null && size) packages = amount / size;
    else packages = product.pieces ? quantity / product.pieces : quantity;
  } else {
    const ml = VOLUME_ML[unit];
    const g = WEIGHT_G[unit];
    if (ml != null) {
      amount = quantity * ml;
      approx = product.baseUnit === "g";
    } else {
      amount = quantity * (g ?? 1);
      approx = product.baseUnit === "ml";
    }
    packages = size ? amount / size : null;
  }
  return { amount, packages, approx };
}

export interface TierCost {
  /** Cost of exactly the amount used (share of the package). */
  used: number | null;
  /** What you pay at the register buying whole packages. */
  shopping: number | null;
  offer: Offer | null;
}

export interface LineResult extends LineAmount {
  packagesToBuy: number | null;
  cost: Record<PriceTier, TierCost>;
  macros: Macros | null;
  warnings: string[];
}

function tierCost(
  product: PricedProduct,
  amt: LineAmount,
  packagesToBuy: number | null,
  tier: PriceTier,
  now: number,
): TierCost {
  // Cost of what's used assumes you take the deal (multi-buy included).
  const best = effectivePrice(product, tier, undefined, now);
  let used: number | null = null;
  if (product.priceBasis === "kg") {
    if (amt.amount != null) used = (amt.amount / 1000) * best.price;
  } else if (amt.packages != null) {
    used = amt.packages * best.price;
  }

  // Shopping cost honors multi-buy minimums strictly.
  let shopping: number | null = null;
  let shoppingOffer: Offer | null = null;
  if (packagesToBuy != null) {
    const p = effectivePrice(product, tier, packagesToBuy, now);
    shoppingOffer = p.offer;
    if (product.priceBasis === "kg") {
      shopping = product.packageSize != null ? packagesToBuy * (product.packageSize / 1000) * p.price : null;
    } else {
      shopping = packagesToBuy * p.price;
    }
  }
  // Weighed goods without a known package size are cut to order: you pay for what you use.
  if (shopping == null && product.priceBasis === "kg" && amt.amount != null) {
    shopping = used;
  }
  return { used, shopping, offer: best.offer ?? shoppingOffer };
}

export function calcLine(product: PricedProduct, line: Pick<LineItem, "quantity" | "unit">, now = Date.now()): LineResult {
  const amt = resolveAmount(product, line);
  const warnings: string[] = [];
  const packagesToBuy = amt.packages != null && amt.packages > 0 ? Math.max(1, Math.ceil(amt.packages - 1e-6)) : null;

  if (amt.approx) warnings.push("Converted between weight and volume assuming 1 g/ml.");
  if (amt.amount == null) warnings.push("Package size unknown — set it on the product to get macros and per-gram cost.");
  else if (amt.packages == null && product.priceBasis === "package")
    warnings.push("Package size unknown — cannot compute cost for this amount.");
  if (!product.nutrition) warnings.push("No nutrition data for this product.");

  const macros =
    product.nutrition && amt.amount != null ? scaleMacros(product.nutrition, amt.amount / 100) : null;

  return {
    ...amt,
    packagesToBuy,
    cost: {
      regular: tierCost(product, amt, packagesToBuy, "regular", now),
      member: tierCost(product, amt, packagesToBuy, "member", now),
    },
    macros,
    warnings,
  };
}

export function scaleMacros(m: Macros, factor: number): Macros {
  return {
    kcal: m.kcal * factor,
    protein: m.protein * factor,
    fat: m.fat * factor,
    carbs: m.carbs * factor,
  };
}

export const ZERO_MACROS: Macros = { kcal: 0, protein: 0, fat: 0, carbs: 0 };

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbs: a.carbs + b.carbs,
  };
}

export interface Totals {
  cost: Record<PriceTier, { used: number; shopping: number }>;
  macros: Macros;
  /** Lines whose cost could not be computed. */
  missingCost: number;
  /** Lines whose macros could not be computed. */
  missingMacros: number;
  lineCount: number;
}

export function calcTotals(results: LineResult[]): Totals {
  const totals: Totals = {
    cost: { regular: { used: 0, shopping: 0 }, member: { used: 0, shopping: 0 } },
    macros: { ...ZERO_MACROS },
    missingCost: 0,
    missingMacros: 0,
    lineCount: results.length,
  };
  for (const r of results) {
    if (r.cost.regular.used == null) totals.missingCost++;
    for (const tier of TIERS) {
      totals.cost[tier].used += r.cost[tier].used ?? 0;
      totals.cost[tier].shopping += r.cost[tier].shopping ?? 0;
    }
    if (r.macros) totals.macros = addMacros(totals.macros, r.macros);
    else totals.missingMacros++;
  }
  return totals;
}

export interface ValueMetrics {
  /** Price per kg (or per litre for liquids). */
  perKg: number | null;
  per100kcal: number | null;
  per10gProtein: number | null;
}

/** Comparable "what am I paying for" numbers for a product at a given tier. */
export function valueMetrics(product: PricedProduct, tier: PriceTier, now = Date.now()): ValueMetrics {
  const { price } = effectivePrice(product, tier, undefined, now);
  const perKg =
    product.priceBasis === "kg"
      ? price
      : product.packageSize
        ? (price / product.packageSize) * 1000
        : null;
  const n = product.nutrition;
  return {
    perKg,
    per100kcal: perKg != null && n && n.kcal > 0 ? (perKg * 10) / n.kcal : null,
    per10gProtein: perKg != null && n && n.protein > 0 ? perKg / n.protein : null,
  };
}

/** Price of one whole package for a tier (useful for display). */
export function packagePrice(product: PricedProduct, tier: PriceTier, now = Date.now()): number | null {
  const { price } = effectivePrice(product, tier, undefined, now);
  if (product.priceBasis === "package") return price;
  return product.packageSize != null ? (price * product.packageSize) / 1000 : null;
}

/** Share of energy coming from protein, fat and carbs (Atwater factors). */
export function energySplit(m: Macros): { protein: number; fat: number; carbs: number } {
  const p = m.protein * 4;
  const f = m.fat * 9;
  const c = m.carbs * 4;
  const sum = p + f + c;
  if (sum <= 0) return { protein: 0, fat: 0, carbs: 0 };
  return { protein: p / sum, fat: f / sum, carbs: c / sum };
}
