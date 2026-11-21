import { parseSize, parseSwedishNumber } from "@/lib/domain/format";
import type { BaseUnit, Macros, Offer, ProductData } from "@/lib/domain/types";
import { fetchJson, StoreError } from "./http";

const BASE = "https://handlaprivatkund.ica.se";

/** e.g. https://handlaprivatkund.ica.se/stores/1004593/products/tonfisk-i-vatten-170g-ica/2092307 */
export function parseIcaUrl(url: URL): { storeId: string; productId: string } | null {
  if (url.hostname !== "handlaprivatkund.ica.se") return null;
  const m = url.pathname.match(/^\/stores\/(\d+)\/products\/(?:[^/]+\/)?(\d+)\/?$/);
  return m ? { storeId: m[1], productId: m[2] } : null;
}

export function icaBopUrl(storeId: string, productId: string): string {
  return `${BASE}/stores/${storeId}/api/webproductpagews/v5/products/bop?retailerProductId=${encodeURIComponent(productId)}`;
}

export function icaProductUrl(storeId: string, productId: string): string {
  return `${BASE}/stores/${storeId}/products/p/${productId}`;
}

interface IcaPromotion {
  description?: string | null;
  longDescription?: string | null;
  requiredProductQuantity?: number | null;
}

export interface IcaBopResponse {
  product?: {
    retailerProductId: string;
    name: string;
    brand?: string | null;
    packSizeDescription?: string | null;
    price?: { amount: string } | null;
    unitPrice?: { price?: { amount: string } | null; unitName?: string | null } | null;
    promotions?: IcaPromotion[];
    image?: { src?: string | null } | null;
  };
  bopData?: { fields?: { title: string; content: string }[] };
  bopPromotions?: IcaPromotion[];
}

export async function fetchIcaProduct(storeId: string, productId: string, url?: string): Promise<ProductData> {
  const raw = await fetchJson<IcaBopResponse>(icaBopUrl(storeId, productId), { storeName: "ICA" });
  return normalizeIcaProduct(raw, storeId, url);
}

export function normalizeIcaProduct(raw: IcaBopResponse, storeId: string, url?: string): ProductData {
  const p = raw.product;
  const price = parseSwedishNumber(p?.price?.amount);
  if (!p?.retailerProductId || price == null) {
    throw new StoreError("parse", "ICA returned a product without a price.");
  }

  const nutritionHtml = raw.bopData?.fields?.find((f) => f.title === "nutritionalData")?.content;
  const nutrition = nutritionHtml ? parseIcaNutrition(nutritionHtml) : null;
  const { size, unit, pieces } = resolveIcaSize(p, price, nutrition?.unit);

  const promos = raw.bopPromotions?.length ? raw.bopPromotions : (p.promotions ?? []);
  return {
    store: "ica",
    storeProductId: p.retailerProductId,
    storeLocation: storeId,
    url: url ?? icaProductUrl(storeId, p.retailerProductId),
    name: p.name.trim(),
    brand: p.brand?.trim() || null,
    imageUrl: p.image?.src ?? null,
    baseUnit: unit,
    packageSize: size,
    pieces,
    priceBasis: "package",
    price,
    offers: promos.map((promo) => parseIcaPromotion(promo, price, size)),
    nutrition: nutrition?.macros ?? null,
  };
}

function resolveIcaSize(
  p: NonNullable<IcaBopResponse["product"]>,
  price: number,
  nutritionUnit: BaseUnit | undefined,
): { size: number | null; unit: BaseUnit; pieces: number | null } {
  const unitName = p.unitPrice?.unitName ?? "";
  const unit: BaseUnit = /1L/i.test(unitName) ? "ml" : (nutritionUnit ?? "g");
  const parsed = parseSize(p.packSizeDescription) ?? parseSize(p.name);
  if (parsed?.size) return { size: parsed.size, unit: parsed.unit, pieces: parsed.pieces };

  const per = parseSwedishNumber(p.unitPrice?.price?.amount);
  if (per && /^PER_1(KG|L)/i.test(unitName)) {
    return { size: Math.round((price / per) * 1000), unit, pieces: null };
  }
  return { size: null, unit, pieces: parsed?.pieces ?? null };
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;

/**
 * ICA promotion texts are free-form Swedish, e.g.
 * "2 för 30 kr -- Stammispris", "19,90 kr/st", "Spara 25%", "Halva priset", "Köp 3 betala för 2".
 */
export function parseIcaPromotion(promo: IcaPromotion, basePrice: number, packageSize: number | null): Offer {
  const text = (promo.description ?? "").trim();
  const memberOnly = /stammis|medlem/i.test(text + " " + (promo.longDescription ?? ""));
  let price: number | null = null;
  let minQuantity = Math.max(1, promo.requiredProductQuantity ?? 1);

  let m: RegExpMatchArray | null;
  if ((m = text.match(new RegExp(String.raw`(\d+)\s*för\s*${NUM}\s*kr`, "i")))) {
    minQuantity = Number(m[1]);
    price = parseSwedishNumber(m[2])! / minQuantity;
  } else if ((m = text.match(/köp\s*(\d+)\s*(?:betala|för priset av|betala för)\s*(?:för\s*)?(\d+)/i))) {
    minQuantity = Number(m[1]);
    price = (basePrice * Number(m[2])) / minQuantity;
  } else if (/halva priset/i.test(text)) {
    price = basePrice / 2;
  } else if ((m = text.match(new RegExp(String.raw`${NUM}\s*%`)))) {
    price = basePrice * (1 - parseSwedishNumber(m[1])! / 100);
  } else if ((m = text.match(new RegExp(String.raw`${NUM}\s*kr\s*/\s*(kg|hg|l)`, "i")))) {
    const perUnit = parseSwedishNumber(m[1])!;
    const scale = m[2].toLowerCase() === "hg" ? 10 : 1;
    price = packageSize ? (perUnit * scale * packageSize) / 1000 : null;
  } else if ((m = text.match(new RegExp(String.raw`${NUM}\s*kr`, "i")))) {
    price = parseSwedishNumber(m[1]);
  }

  return {
    label: text.replace(/\s*--\s*/g, " · ") || "Erbjudande",
    memberOnly,
    price: price != null ? Math.round(price * 100) / 100 : null,
    minQuantity,
    validUntil: parseIcaValidity(promo.longDescription),
  };
}

/** "5/10-11/10 2026, erbj jfr pris ..." → end of 11 Oct 2026 (Swedish time, approximated as UTC+2). */
export function parseIcaValidity(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/\d{1,2}\/\d{1,2}\s*-\s*(\d{1,2})\/(\d{1,2})\s+(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 21, 59, 59)).toISOString();
}

/** Parse ICA's nutrition HTML table into macros per 100 g/ml. */
export function parseIcaNutrition(html: string): { macros: Macros; unit: BaseUnit } | null {
  const rows = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)].map((r) =>
    [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => stripTags(c[1])),
  );
  if (!rows.length) return null;
  const header = rows[0].join(" ").toLowerCase();
  const unit: BaseUnit = /milliliter|\bml\b/.test(header) ? "ml" : "g";

  const value = (pred: (label: string) => boolean) => {
    const row = rows.find((r) => r.length >= 2 && pred(r[0].toLowerCase()));
    return row ? parseSwedishNumber(row[1]) : null;
  };
  let kcal = value((l) => l.startsWith("energi") && l.includes("kcal"));
  if (kcal == null) {
    const kj = value((l) => l.startsWith("energi") && l.includes("kj"));
    if (kj != null) kcal = Math.round(kj / 4.184);
  }
  const fat = value((l) => l === "fett");
  const carbs = value((l) => l === "kolhydrat" || l === "kolhydrater");
  const protein = value((l) => l === "protein");
  if (kcal == null && fat == null && carbs == null && protein == null) return null;
  return { macros: { kcal: kcal ?? 0, protein: protein ?? 0, fat: fat ?? 0, carbs: carbs ?? 0 }, unit };
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
