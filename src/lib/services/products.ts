import "server-only";
import type { Product } from "@/lib/domain/types";
import { getProductsByIds, NotFoundError, upsertFromStore } from "@/lib/repo/products";
import { fetchProduct, parseProductUrl, StoreError } from "@/lib/stores";
import { normalizeIcaProduct, type IcaBopResponse } from "@/lib/stores/ica";

export async function importFromUrl(url: string) {
  const ref = parseProductUrl(url);
  const data = await fetchProduct(ref);
  return upsertFromStore(data);
}

/** Store data captured in the user's own browser (see the ICA bookmarklet). */
export function ingestIcaPayload(payload: unknown, url: string) {
  const ref = parseProductUrl(url);
  if (ref.store !== "ica") throw new StoreError("unsupported-url", "Expected an ICA product link.");
  const data = normalizeIcaProduct(payload as IcaBopResponse, ref.storeLocation, ref.url);
  if (data.storeProductId !== ref.storeProductId) {
    throw new StoreError("parse", "The captured product doesn't match the page it came from.");
  }
  return upsertFromStore(data);
}

export type RefreshResult =
  | { id: number; ok: true; product: Product }
  | { id: number; ok: false; error: string; code?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Refresh prices for several products. Requests are spaced out, and once a store blocks us
 * we stop asking it for the rest of the batch instead of digging the hole deeper.
 */
export async function refreshProducts(ids: number[]): Promise<RefreshResult[]> {
  const products = getProductsByIds(ids);
  const found = new Set(products.map((p) => p.id));
  const results: RefreshResult[] = ids
    .filter((id) => !found.has(id))
    .map((id) => ({ id, ok: false as const, error: "Product not found." }));

  const blocked = new Set<string>();
  let first = true;
  for (const p of products) {
    if (p.store === "manual") {
      results.push({ id: p.id, ok: true, product: p });
      continue;
    }
    if (blocked.has(p.store)) {
      results.push({ id: p.id, ok: false, error: "Skipped: the store is blocking requests right now.", code: "blocked" });
      continue;
    }
    if (!first) await sleep(p.store === "ica" ? 1500 : 300);
    first = false;
    try {
      const data = await fetchProduct({ store: p.store, storeProductId: p.storeProductId, storeLocation: p.storeLocation, url: p.url ?? "" });
      results.push({ id: p.id, ok: true, product: upsertFromStore(data).product });
    } catch (err) {
      if (err instanceof StoreError) {
        if (err.code === "blocked") blocked.add(p.store);
        results.push({ id: p.id, ok: false, error: err.message, code: err.code });
      } else {
        results.push({ id: p.id, ok: false, error: "Unexpected error while refreshing." });
        console.error(err);
      }
    }
  }
  return results;
}

export async function refreshProduct(id: number): Promise<Product> {
  const [result] = await refreshProducts([id]);
  if (result.ok) return result.product;
  if (result.error === "Product not found.") throw new NotFoundError(result.error);
  throw new StoreError((result.code as StoreError["code"]) ?? "upstream", result.error);
}
