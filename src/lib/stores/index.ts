import type { ProductData, StoreId } from "@/lib/domain/types";
import { StoreError } from "./http";
import { fetchIcaProduct, parseIcaUrl } from "./ica";
import { fetchWillysProduct, parseWillysUrl, willysProductUrl } from "./willys";

export { StoreError } from "./http";

export interface ProductRef {
  store: Exclude<StoreId, "manual">;
  storeProductId: string;
  storeLocation: string;
  url: string;
}

export const STORE_META: Record<StoreId, { name: string; member: string; host?: string }> = {
  willys: { name: "Willys", member: "Willys Plus", host: "willys.se" },
  ica: { name: "ICA", member: "Stammis", host: "handlaprivatkund.ica.se" },
  manual: { name: "Manual", member: "Member" },
};

export function parseProductUrl(input: string): ProductRef {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new StoreError("unsupported-url", "That doesn't look like a link.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new StoreError("unsupported-url", "Only web links are supported.");
  }

  const willys = parseWillysUrl(url);
  if (willys) {
    return { store: "willys", storeProductId: willys.code, storeLocation: "", url: willysProductUrl(willys.code) };
  }
  const ica = parseIcaUrl(url);
  if (ica) {
    return {
      store: "ica",
      storeProductId: ica.productId,
      storeLocation: ica.storeId,
      url: `https://handlaprivatkund.ica.se${url.pathname}`,
    };
  }
  throw new StoreError(
    "unsupported-url",
    "Only Willys (willys.se/produkt/…) and ICA (handlaprivatkund.ica.se/stores/…/products/…) product links are supported.",
  );
}

export async function fetchProduct(ref: Pick<ProductRef, "store" | "storeProductId" | "storeLocation" | "url">): Promise<ProductData> {
  switch (ref.store) {
    case "willys":
      return fetchWillysProduct(ref.storeProductId, ref.url);
    case "ica":
      return fetchIcaProduct(ref.storeLocation, ref.storeProductId, ref.url);
  }
}
