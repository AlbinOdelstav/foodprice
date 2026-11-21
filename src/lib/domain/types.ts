export const STORES = ["willys", "ica", "manual"] as const;
export type StoreId = (typeof STORES)[number];

/** Macros per 100 g (or 100 ml for liquids). */
export interface Macros {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

/** Unit the package size and nutrition basis are expressed in. */
export type BaseUnit = "g" | "ml";

/**
 * How the shelf price is quoted:
 * - "package": price per item/package (most products)
 * - "kg": price per kilo (weighed goods such as deli cheese)
 */
export type PriceBasis = "package" | "kg";

export interface Offer {
  /** Human readable label, e.g. "2 för 30 kr" or "Spara 39 kr/kg". */
  label: string;
  /** True when the offer requires a loyalty membership (Willys Plus, ICA Stammis). */
  memberOnly: boolean;
  /** Offer price per unit in the same basis as the product price; null when it could not be parsed. */
  price: number | null;
  /** Number of items you must buy for the offer to apply (multi-buy). */
  minQuantity: number;
  validUntil: string | null;
}

/** Normalized product as returned by a store adapter. */
export interface ProductData {
  store: StoreId;
  storeProductId: string;
  /** Store-specific location, e.g. the ICA store id. Empty when not applicable. */
  storeLocation: string;
  url: string | null;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  baseUnit: BaseUnit;
  /** Net size of one package in baseUnit (g or ml). */
  packageSize: number | null;
  /** Number of pieces in one package, e.g. 12 eggs. */
  pieces: number | null;
  priceBasis: PriceBasis;
  price: number;
  offers: Offer[];
  nutrition: Macros | null;
}

/** Fields a user can manually override; refreshes from the store leave them untouched. */
export const OVERRIDABLE_FIELDS = [
  "name",
  "brand",
  "baseUnit",
  "packageSize",
  "pieces",
  "pieceSize",
  "price",
  "priceBasis",
  "nutrition",
] as const;
export type OverridableField = (typeof OVERRIDABLE_FIELDS)[number];

/** A product as stored and sent to the client. */
export interface Product extends ProductData {
  id: number;
  /** Explicit weight of one piece in baseUnit; overrides packageSize / pieces. */
  pieceSize: number | null;
  overrides: OverridableField[];
  fetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const LINE_UNITS = ["g", "kg", "ml", "dl", "l", "st", "pkg"] as const;
export type LineUnit = (typeof LINE_UNITS)[number];

export interface LineItem {
  productId: number;
  quantity: number;
  unit: LineUnit;
}

export interface Recipe {
  id: number;
  name: string;
  servings: number;
  notes: string | null;
  items: (LineItem & { id: number; position: number })[];
  createdAt: string;
  updatedAt: string;
}

export type PriceTier = "regular" | "member";
