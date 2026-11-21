import type { BaseUnit, LineUnit } from "./types";

const sek = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num0 = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });

/** "1 234,50 kr" */
export function formatSek(value: number | null | undefined, opts: { suffix?: boolean } = {}): string {
  if (value == null || !Number.isFinite(value)) return "–";
  const s = sek.format(value);
  return opts.suffix === false ? s : `${s} kr`;
}

export function formatNumber(value: number | null | undefined, decimals: 0 | 1 = 0): string {
  if (value == null || !Number.isFinite(value)) return "–";
  return (decimals === 0 ? num0 : num1).format(value);
}

/** Grams/ml formatted with a sensible unit, e.g. 1500 g → "1,5 kg". */
export function formatAmount(amount: number | null | undefined, unit: BaseUnit): string {
  if (amount == null || !Number.isFinite(amount)) return "–";
  if (amount >= 1000) return `${num1.format(amount / 1000)} ${unit === "g" ? "kg" : "l"}`;
  return `${num0.format(amount)} ${unit}`;
}

export function perKgLabel(unit: BaseUnit): string {
  return unit === "ml" ? "kr/l" : "kr/kg";
}

export const UNIT_LABELS: Record<LineUnit, string> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  dl: "dl",
  l: "l",
  st: "st",
  pkg: "pkg",
};

/** Parse Swedish-style numbers: "1,5", "1 234,50", "<0.5". */
export function parseSwedishNumber(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const cleaned = input
    .replace(/ /g, " ")
    .replace(/[<>~≈]|\bca\b\.?:?/gi, "")
    .replace(/\s+/g, "")
    .replace(",", ".");
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/**
 * Parse a package size description like "1,5kg", "500 g", "6x33cl", "ca: 2.2kg", "1l".
 * Returns the total size in g or ml, plus the number of pieces when given as "N x size" or "12-p".
 */
export function parseSize(
  input: string | null | undefined,
): { size: number | null; unit: BaseUnit; pieces: number | null } | null {
  if (!input) return null;
  const s = input.toLowerCase().replace(/ /g, " ").replace(",", ".");
  const multi = s.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|l|dl|cl|ml)\b/);
  const single = s.match(/(\d+(?:\.\d+)?)\s*(kg|g|l|dl|cl|ml)\b/);
  const pack = s.match(/(\d+)\s*-?\s*(?:p|pack|st)\b/);
  const factor: Record<string, [number, BaseUnit]> = {
    kg: [1000, "g"],
    g: [1, "g"],
    l: [1000, "ml"],
    dl: [100, "ml"],
    cl: [10, "ml"],
    ml: [1, "ml"],
  };
  if (multi) {
    const [mul, unit] = factor[multi[3]];
    const count = Number(multi[1]);
    return { size: round(count * Number(multi[2]) * mul), unit, pieces: count };
  }
  if (single) {
    const [mul, unit] = factor[single[2]];
    return { size: round(Number(single[1]) * mul), unit, pieces: pack ? Number(pack[1]) : null };
  }
  if (pack) return { size: null, unit: "g", pieces: Number(pack[1]) };
  return null;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
