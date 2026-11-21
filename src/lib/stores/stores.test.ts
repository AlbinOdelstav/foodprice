import { describe, expect, it } from "vitest";
import { parseProductUrl } from ".";
import icaTonfisk from "./__fixtures__/ica-tonfisk.json";
import willysHavre from "./__fixtures__/willys-havregryn.json";
import willysOst from "./__fixtures__/willys-hushallsost.json";
import willysSearch from "./__fixtures__/willys-search.json";
import { normalizeIcaProduct, parseIcaNutrition, parseIcaPromotion, parseIcaValidity } from "./ica";
import { normalizeWillysProduct, normalizeWillysPromotion, type WillysProduct } from "./willys";

describe("parseProductUrl", () => {
  it("recognizes Willys product links", () => {
    const ref = parseProductUrl("https://www.willys.se/produkt/Hushallsost-26procent-101197478_KG");
    expect(ref).toMatchObject({ store: "willys", storeProductId: "101197478_KG", storeLocation: "" });
  });

  it("recognizes ICA product links including the store id", () => {
    const ref = parseProductUrl("https://handlaprivatkund.ica.se/stores/1004593/products/tonfisk-i-vatten-170g-ica/2092307");
    expect(ref).toMatchObject({ store: "ica", storeProductId: "2092307", storeLocation: "1004593" });
  });

  it("rejects other sites and garbage", () => {
    expect(() => parseProductUrl("https://www.coop.se/handla/varor/x")).toThrow(/Only Willys/);
    expect(() => parseProductUrl("not a url")).toThrow(/doesn't look like a link/);
    expect(() => parseProductUrl("javascript:alert(1)")).toThrow();
  });
});

describe("Willys", () => {
  it("normalizes a weighed product with a member offer", () => {
    const p = normalizeWillysProduct(willysOst as unknown as WillysProduct);
    expect(p).toMatchObject({
      store: "willys",
      storeProductId: "101197478_KG",
      name: "Hushållsost 26%",
      brand: "Arla",
      priceBasis: "kg",
      price: 108.9,
      baseUnit: "g",
      packageSize: 2200,
      nutrition: { kcal: 337, protein: 25, fat: 26, carbs: 0 },
    });
    expect(p.offers).toHaveLength(1);
    expect(p.offers[0]).toMatchObject({ memberOnly: true, price: 69.9, minQuantity: 1 });
    expect(p.offers[0].label).toContain("69,90 kr/kg");
  });

  it("normalizes a packaged product", () => {
    const p = normalizeWillysProduct(willysHavre as unknown as WillysProduct);
    expect(p).toMatchObject({ priceBasis: "package", price: 17.9, packageSize: 1500, baseUnit: "g" });
    expect(p.nutrition?.kcal).toBeGreaterThan(300);
    expect(p.nutrition?.protein).toBeGreaterThan(10);
  });

  it("normalizes general multi-buy promotions", () => {
    const pasta = (willysSearch.results as unknown as WillysProduct[]).find((r) => r.name.startsWith("Mezzi"))!;
    const offer = normalizeWillysPromotion(pasta.potentialPromotions![0], false);
    expect(offer).toMatchObject({ memberOnly: false, price: 16, minQuantity: 2, label: "2 för 32 kr" });
  });
});

describe("ICA", () => {
  it("normalizes a product with a Stammis multi-buy offer and nutrition table", () => {
    const p = normalizeIcaProduct(icaTonfisk, "1004593");
    expect(p).toMatchObject({
      store: "ica",
      storeProductId: "2092307",
      storeLocation: "1004593",
      name: "Tonfisk i vatten 170g ICA",
      priceBasis: "package",
      price: 19.82,
      packageSize: 120,
      baseUnit: "g",
      nutrition: { kcal: 106, protein: 24, fat: 1, carbs: 0 },
    });
    expect(p.offers[0]).toMatchObject({ memberOnly: true, price: 15, minQuantity: 2 });
    expect(p.offers[0].validUntil).toBe("2026-10-11T21:59:59.000Z");
  });

  it("parses common promotion phrasings", () => {
    const parse = (description: string) => parseIcaPromotion({ description }, 40, 500);
    expect(parse("Halva priset")).toMatchObject({ price: 20, memberOnly: false });
    expect(parse("Spara 25%")).toMatchObject({ price: 30 });
    expect(parse("Köp 3 betala för 2")).toMatchObject({ price: 26.67, minQuantity: 3 });
    expect(parse("29,90 kr/st -- Stammispris")).toMatchObject({ price: 29.9, memberOnly: true });
    expect(parse("59,90 kr/kg")).toMatchObject({ price: 29.95 });
    expect(parse("Gratis frakt")).toMatchObject({ price: null });
  });

  it("parses validity and liquid nutrition", () => {
    expect(parseIcaValidity("nothing here")).toBeNull();
    const n = parseIcaNutrition(
      "<table><tr><th>Näringsvärde</th><th>100 Milliliter</th></tr><tr><td>Energi (kJ)</td><td>197 kJ</td></tr><tr><td>Fett</td><td>1,5 g</td></tr><tr><td>Kolhydrat</td><td>4,8 g</td></tr><tr><td>Protein</td><td>3,5 g</td></tr></table>",
    );
    expect(n).toEqual({ unit: "ml", macros: { kcal: 47, fat: 1.5, carbs: 4.8, protein: 3.5 } });
  });
});
