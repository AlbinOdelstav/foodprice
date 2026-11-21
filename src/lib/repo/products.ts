import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { products, recipeItems, recipes } from "@/lib/db/schema";
import type { OverridableField, Product, ProductData } from "@/lib/domain/types";
import { OVERRIDABLE_FIELDS } from "@/lib/domain/types";

type Row = typeof products.$inferSelect;

export class ConflictError extends Error {}
export class NotFoundError extends Error {}

function toProduct(row: Row): Product {
  return {
    ...row,
    offers: row.offers ?? [],
    overrides: row.overrides ?? [],
  };
}

const now = () => new Date().toISOString();

export function listProducts(): Product[] {
  return getDb().select().from(products).orderBy(desc(products.updatedAt)).all().map(toProduct);
}

export function getProduct(id: number): Product | null {
  const row = getDb().select().from(products).where(eq(products.id, id)).get();
  return row ? toProduct(row) : null;
}

export function getProductsByIds(ids: number[]): Product[] {
  if (!ids.length) return [];
  return getDb().select().from(products).where(inArray(products.id, ids)).all().map(toProduct);
}

export function findByStoreRef(store: string, storeProductId: string, storeLocation: string): Product | null {
  const row = getDb()
    .select()
    .from(products)
    .where(
      and(
        eq(products.store, store as Row["store"]),
        eq(products.storeProductId, storeProductId),
        eq(products.storeLocation, storeLocation),
      ),
    )
    .get();
  return row ? toProduct(row) : null;
}

/** Insert a freshly fetched product, or refresh an existing one while keeping user overrides. */
export function upsertFromStore(data: ProductData): { product: Product; created: boolean } {
  const db = getDb();
  const existing = findByStoreRef(data.store, data.storeProductId, data.storeLocation);
  const fetchedAt = now();

  if (!existing) {
    const row = db
      .insert(products)
      .values({ ...data, fetchedAt, pieceSize: null, overrides: [] })
      .returning()
      .get();
    return { product: toProduct(row), created: true };
  }

  const locked = new Set(existing.overrides);
  const update: Partial<typeof products.$inferInsert> = {
    url: data.url ?? existing.url,
    imageUrl: data.imageUrl ?? existing.imageUrl,
    offers: data.offers,
    fetchedAt,
    updatedAt: fetchedAt,
  };
  const assign = <K extends OverridableField & keyof ProductData>(key: K) => {
    if (locked.has(key)) return;
    // Don't wipe values we had just because the store omitted them this time.
    if (data[key] == null && key !== "brand") return;
    (update as Record<string, unknown>)[key] = data[key];
  };
  (["name", "brand", "baseUnit", "packageSize", "pieces", "price", "priceBasis", "nutrition"] as const).forEach(assign);

  const row = db.update(products).set(update).where(eq(products.id, existing.id)).returning().get();
  return { product: toProduct(row), created: false };
}

export type ManualProductInput = Omit<ProductData, "store" | "storeProductId" | "storeLocation"> & {
  pieceSize?: number | null;
};

export function createManualProduct(input: ManualProductInput): Product {
  const row = getDb()
    .insert(products)
    .values({
      ...input,
      pieceSize: input.pieceSize ?? null,
      store: "manual",
      storeProductId: crypto.randomUUID(),
      storeLocation: "",
      overrides: [],
    })
    .returning()
    .get();
  return toProduct(row);
}

export type ProductPatch = Partial<Pick<Product, OverridableField>> & { clearOverrides?: boolean };

export function updateProduct(id: number, patch: ProductPatch): Product {
  const existing = getProduct(id);
  if (!existing) throw new NotFoundError("Product not found.");

  const { clearOverrides, ...fields } = patch;
  const changed = OVERRIDABLE_FIELDS.filter(
    (k) => k in fields && JSON.stringify(fields[k]) !== JSON.stringify(existing[k]),
  );
  const overrides =
    existing.store === "manual" || clearOverrides
      ? []
      : Array.from(new Set([...existing.overrides, ...changed]));

  const row = getDb()
    .update(products)
    .set({ ...fields, overrides, updatedAt: now() })
    .where(eq(products.id, id))
    .returning()
    .get();
  return toProduct(row);
}

export function productUsage(id: number): { id: number; name: string }[] {
  return getDb()
    .selectDistinct({ id: recipes.id, name: recipes.name })
    .from(recipeItems)
    .innerJoin(recipes, eq(recipes.id, recipeItems.recipeId))
    .where(eq(recipeItems.productId, id))
    .all();
}

export function deleteProduct(id: number): void {
  const usage = productUsage(id);
  if (usage.length) {
    throw new ConflictError(`Used in ${usage.map((r) => `“${r.name}”`).join(", ")}. Remove it from those recipes first.`);
  }
  getDb().delete(products).where(eq(products.id, id)).run();
}
