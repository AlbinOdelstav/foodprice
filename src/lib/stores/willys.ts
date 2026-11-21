import { parseSize, parseSwedishNumber } from "@/lib/domain/format";
import type { BaseUnit, Macros, Offer, ProductData } from "@/lib/domain/types";
import { fetchJson, StoreError } from "./http";

const BASE = "https://www.willys.se";

/** Product codes look like "101197478_KG" (weighed) or "101833307_ST" (per item). */
const CODE_RE = /(\d{6,}_[A-Z]{2,})/;

export function parseWillysUrl(url: URL): { code: string } | null {
  if (!/(^|\.)willys\.se$/.test(url.hostname)) return null;
  const m = decodeURIComponent(url.pathname).match(CODE_RE);
  return m ? { code: m[1] } : null;
}

interface WillysPrice {
  value: number;
}

export interface WillysPromotion {
  campaignType?: string | null;
  promotionType?: string | null;
  price?: WillysPrice | null;
  qualifyingCount?: number | null;
  conditionLabel?: string | null;
  rewardLabel?: string | null;
  redeemLimitLabel?: string | null;
  validUntil?: number | null;
}

interface WillysNutrient {
  nutrientTypeCode: string;
  quantityContained: string;
  measurementUnitCode: string;
}

interface WillysNutrientHeader {
  nutrientBasisQuantity?: string | null;
  nutrientBasisQuantityMeasurementUnitCode?: string | null;
  preparationStateCode?: string | null;
  nutrientDetails?: WillysNutrient[];
}

export interface WillysProduct {
  code: string;
  name: string;
  manufacturer?: string | null;
  priceValue: number;
  priceUnit?: string | null;
  comparePrice?: string | null;
  comparePriceUnit?: string | null;
  displayVolume?: string | null;
  averageWeight?: number | null;
  image?: { url?: string | null } | null;
  thumbnail?: { url?: string | null } | null;
  potentialPromotions?: WillysPromotion[];
  nutrientHeaders?: WillysNutrientHeader[];
}

export async function fetchWillysProduct(code: string, url?: string): Promise<ProductData> {
  const raw = await fetchJson<WillysProduct>(`${BASE}/axfood/rest/p/${encodeURIComponent(code)}`, {
    storeName: "Willys",
  });
  if (!raw?.code || typeof raw.priceValue !== "number") {
    throw new StoreError("parse", "Willys returned a product without a price.");
  }
  return normalizeWillysProduct(raw, url);
}

export function willysProductUrl(code: string): string {
  return `${BASE}/produkt/${code}`;
}

export function normalizeWillysProduct(raw: WillysProduct, url?: string): ProductData {
  const weighed = /kg/i.test(raw.priceUnit ?? "") || raw.code.endsWith("_KG");
  const { size, unit, pieces } = resolveSize(raw, weighed);

  return {
    store: "willys",
    storeProductId: raw.code,
    storeLocation: "",
    url: url ?? willysProductUrl(raw.code),
    name: raw.name.trim(),
    brand: raw.manufacturer?.trim() || null,
    imageUrl: raw.image?.url || raw.thumbnail?.url || null,
    baseUnit: unit,
    packageSize: size,
    pieces,
    priceBasis: weighed ? "kg" : "package",
    price: raw.priceValue,
    offers: (raw.potentialPromotions ?? []).map((p) => normalizeWillysPromotion(p, weighed)),
    nutrition: parseWillysNutrition(raw.nutrientHeaders),
  };
}

function resolveSize(raw: WillysProduct, weighed: boolean): { size: number | null; unit: BaseUnit; pieces: number | null } {
  const cmpUnit = (raw.comparePriceUnit ?? "").toLowerCase();
  const unit: BaseUnit = cmpUnit === "l" ? "ml" : "g";

  if (weighed) {
    // Weighed goods are sold as whole pieces of roughly `averageWeight` kg.
    const size = raw.averageWeight ? raw.averageWeight * 1000 : (parseSize(raw.displayVolume)?.size ?? null);
    return { size: size || null, unit, pieces: null };
  }

  const parsed = parseSize(raw.displayVolume);
  if (parsed?.size) return { size: parsed.size, unit: parsed.unit, pieces: parsed.pieces };

  // Fall back to deriving the size from price / compare price (kr per kg or l).
  const compare = parseSwedishNumber(raw.comparePrice);
  if (compare && (cmpUnit === "kg" || cmpUnit === "l")) {
    return { size: Math.round((raw.priceValue / compare) * 1000), unit, pieces: parsed?.pieces ?? null };
  }
  if (compare && cmpUnit === "st") {
    return { size: null, unit, pieces: Math.round(raw.priceValue / compare) || null };
  }
  return { size: null, unit, pieces: parsed?.pieces ?? null };
}

export function normalizeWillysPromotion(p: WillysPromotion, weighed: boolean): Offer {
  const minQuantity = Math.max(1, p.qualifyingCount ?? 1);
  const price = p.price?.value ?? null;
  let label: string;
  if (price != null && minQuantity > 1) label = `${minQuantity} för ${formatKr(price * minQuantity)}`;
  else if (price != null) label = `${formatKr(price)}${weighed ? "/kg" : "/st"}`;
  else label = p.conditionLabel || p.rewardLabel || "Erbjudande";
  if (p.redeemLimitLabel) label += ` · ${p.redeemLimitLabel}`;

  return {
    label,
    memberOnly: (p.campaignType ?? "").toUpperCase() === "LOYALTY",
    price,
    minQuantity,
    validUntil: p.validUntil ? new Date(p.validUntil).toISOString() : null,
  };
}

function formatKr(n: number): string {
  return `${n.toFixed(2).replace(".", ",").replace(/,00$/, "")} kr`;
}

export function parseWillysNutrition(headers: WillysNutrientHeader[] | undefined): Macros | null {
  if (!headers?.length) return null;
  const per100 = headers.filter((h) => parseSwedishNumber(h.nutrientBasisQuantity ?? "") === 100);
  const header =
    per100.find((h) => !h.preparationStateCode || /UNPREPARED/i.test(h.preparationStateCode)) ?? per100[0];
  if (!header?.nutrientDetails?.length) return null;

  const find = (pred: (n: WillysNutrient) => boolean) => {
    const n = header.nutrientDetails!.find(pred);
    return n ? parseSwedishNumber(n.quantityContained) : null;
  };
  const code = (n: WillysNutrient) => n.nutrientTypeCode.trim().toLowerCase();
  const unit = (n: WillysNutrient) => n.measurementUnitCode.trim().toLowerCase();

  let kcal = find((n) => code(n).startsWith("energi") && /kilokalori|kcal/.test(unit(n)));
  if (kcal == null) {
    const kj = find((n) => code(n).startsWith("energi") && /kilojoule|kj/.test(unit(n)));
    if (kj != null) kcal = Math.round(kj / 4.184);
  }
  const fat = find((n) => code(n) === "fett");
  const carbs = find((n) => code(n) === "kolhydrat" || code(n) === "kolhydrater");
  const protein = find((n) => code(n) === "protein");
  if (kcal == null && fat == null && carbs == null && protein == null) return null;
  return { kcal: kcal ?? 0, protein: protein ?? 0, fat: fat ?? 0, carbs: carbs ?? 0 };
}

export interface StoreSearchHit {
  store: "willys";
  storeProductId: string;
  name: string;
  brand: string | null;
  size: string | null;
  price: number;
  priceUnit: string;
  imageUrl: string | null;
  offers: Offer[];
}

interface WillysSearchResponse {
  results?: (WillysProduct & { productLine2?: string })[];
}

export async function searchWillys(query: string, size = 24): Promise<StoreSearchHit[]> {
  const q = encodeURIComponent(query.trim());
  const data = await fetchJson<WillysSearchResponse>(`${BASE}/search/clean?q=${q}&size=${size}`, {
    storeName: "Willys",
  });
  return (data.results ?? []).map((r) => {
    const weighed = /kg/i.test(r.priceUnit ?? "") || r.code.endsWith("_KG");
    return {
      store: "willys" as const,
      storeProductId: r.code,
      name: r.name,
      brand: r.manufacturer ?? null,
      size: r.displayVolume ?? null,
      price: r.priceValue,
      priceUnit: r.priceUnit ?? "kr/st",
      imageUrl: r.thumbnail?.url ?? r.image?.url ?? null,
      offers: (r.potentialPromotions ?? []).map((p) => normalizeWillysPromotion(p, weighed)),
    };
  });
}
