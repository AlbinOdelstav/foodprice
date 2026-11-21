import { describe, expect, it } from "vitest";
import { calcLine, calcTotals, effectivePrice, energySplit, valueMetrics } from "./calc";
import { parseSize, parseSwedishNumber } from "./format";
import type { Offer, Product } from "./types";

const NOW = Date.parse("2026-10-06T12:00:00Z");

function product(over: Partial<Product> = {}): Product {
  return {
    id: 1,
    store: "willys",
    storeProductId: "x",
    storeLocation: "",
    url: null,
    name: "Pasta",
    brand: null,
    imageUrl: null,
    baseUnit: "g",
    packageSize: 500,
    pieces: null,
    pieceSize: null,
    priceBasis: "package",
    price: 20,
    offers: [],
    nutrition: { kcal: 350, protein: 12, fat: 2, carbs: 70 },
    overrides: [],
    fetchedAt: null,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

const offer = (o: Partial<Offer>): Offer => ({ label: "", memberOnly: false, price: 10, minQuantity: 1, validUntil: null, ...o });

describe("effectivePrice", () => {
  it("only gives member offers to members", () => {
    const p = product({ offers: [offer({ memberOnly: true, price: 15 })] });
    expect(effectivePrice(p, "regular", undefined, NOW).price).toBe(20);
    expect(effectivePrice(p, "member", undefined, NOW).price).toBe(15);
  });

  it("ignores expired offers and honors multi-buy minimums when a quantity is given", () => {
    const p = product({
      offers: [
        offer({ price: 5, validUntil: "2026-10-01T00:00:00Z" }),
        offer({ price: 16, minQuantity: 2 }),
      ],
    });
    expect(effectivePrice(p, "regular", undefined, NOW).price).toBe(16);
    expect(effectivePrice(p, "regular", 1, NOW).price).toBe(20);
    expect(effectivePrice(p, "regular", 2, NOW).price).toBe(16);
  });
});

describe("calcLine", () => {
  it("prices the used share and the whole packages separately", () => {
    const r = calcLine(product(), { quantity: 200, unit: "g" }, NOW);
    expect(r.amount).toBe(200);
    expect(r.packages).toBeCloseTo(0.4);
    expect(r.packagesToBuy).toBe(1);
    expect(r.cost.regular.used).toBeCloseTo(8);
    expect(r.cost.regular.shopping).toBe(20);
    expect(r.macros).toEqual({ kcal: 700, protein: 24, fat: 4, carbs: 140 });
  });

  it("applies multi-buy to shopping cost only when enough packages are bought", () => {
    const p = product({ offers: [offer({ price: 16, minQuantity: 2 })] });
    const one = calcLine(p, { quantity: 1, unit: "pkg" }, NOW);
    expect(one.cost.regular.used).toBe(16);
    expect(one.cost.regular.shopping).toBe(20);
    const two = calcLine(p, { quantity: 900, unit: "g" }, NOW);
    expect(two.packagesToBuy).toBe(2);
    expect(two.cost.regular.shopping).toBe(32);
  });

  it("handles weighed goods priced per kg", () => {
    const cheese = product({
      priceBasis: "kg",
      price: 108.9,
      packageSize: 2200,
      offers: [offer({ memberOnly: true, price: 69.9 })],
    });
    const r = calcLine(cheese, { quantity: 100, unit: "g" }, NOW);
    expect(r.cost.regular.used).toBeCloseTo(10.89);
    expect(r.cost.member.used).toBeCloseTo(6.99);
    expect(r.cost.regular.shopping).toBeCloseTo(239.58);
  });

  it("supports pieces with an explicit piece size and packs of pieces", () => {
    const eggs = product({ name: "Ägg", packageSize: 636, pieces: 12, price: 48 });
    const r = calcLine(eggs, { quantity: 3, unit: "st" }, NOW);
    expect(r.amount).toBeCloseTo(159);
    expect(r.cost.regular.used).toBeCloseTo(12);

    const lemon = product({ packageSize: null, pieceSize: 120, price: 6 });
    const l = calcLine(lemon, { quantity: 2, unit: "st" }, NOW);
    expect(l.amount).toBe(240);
    expect(l.cost.regular.used).toBe(12);
  });

  it("flags weight/volume conversions and missing data", () => {
    const milk = product({ baseUnit: "ml", packageSize: 1000, nutrition: null });
    const r = calcLine(milk, { quantity: 2, unit: "dl" }, NOW);
    expect(r.amount).toBe(200);
    expect(r.approx).toBe(false);
    expect(r.macros).toBeNull();
    expect(r.warnings.join()).toMatch(/nutrition/);

    const flour = calcLine(product(), { quantity: 1, unit: "dl" }, NOW);
    expect(flour.approx).toBe(true);
  });
});

describe("totals and metrics", () => {
  it("sums lines and counts missing data", () => {
    const a = calcLine(product(), { quantity: 250, unit: "g" }, NOW);
    const b = calcLine(product({ nutrition: null }), { quantity: 1, unit: "pkg" }, NOW);
    const t = calcTotals([a, b]);
    expect(t.cost.regular.used).toBeCloseTo(30);
    expect(t.cost.regular.shopping).toBe(40);
    expect(t.macros.kcal).toBeCloseTo(875);
    expect(t.missingMacros).toBe(1);
  });

  it("computes comparable value metrics", () => {
    const m = valueMetrics(product(), "regular", NOW);
    expect(m.perKg).toBe(40);
    expect(m.per100kcal).toBeCloseTo(40 * 10 / 350);
    expect(m.per10gProtein).toBeCloseTo(40 / 12);
  });

  it("splits energy by macro", () => {
    const s = energySplit({ kcal: 0, protein: 25, fat: 0, carbs: 25 });
    expect(s).toEqual({ protein: 0.5, fat: 0, carbs: 0.5 });
  });
});

describe("format parsing", () => {
  it.each([
    ["1,5kg", 1500, "g", null],
    ["500 g", 500, "g", null],
    ["6x33cl", 1980, "ml", 6],
    ["ca: 2.2kg", 2200, "g", null],
    ["1l", 1000, "ml", null],
    ["0.12kg", 120, "g", null],
  ])("parseSize(%s)", (input, size, unit, pieces) => {
    expect(parseSize(input)).toEqual({ size, unit, pieces });
  });

  it("parses Swedish numbers", () => {
    expect(parseSwedishNumber("1 234,50")).toBe(1234.5);
    expect(parseSwedishNumber("<0,5")).toBe(0.5);
    expect(parseSwedishNumber("106 kcal")).toBe(106);
    expect(parseSwedishNumber("ca 3")).toBe(3);
  });
});
