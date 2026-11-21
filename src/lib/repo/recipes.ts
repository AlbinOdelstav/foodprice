import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { recipeItems, recipes } from "@/lib/db/schema";
import type { LineItem, Recipe } from "@/lib/domain/types";
import { getProductsByIds, NotFoundError } from "./products";

export interface RecipeInput {
  name: string;
  servings: number;
  notes?: string | null;
  items: LineItem[];
}

type RecipeRow = typeof recipes.$inferSelect;
type ItemRow = typeof recipeItems.$inferSelect;

function assemble(rows: RecipeRow[], items: ItemRow[]): Recipe[] {
  const byRecipe = new Map<number, ItemRow[]>();
  for (const item of items) {
    const list = byRecipe.get(item.recipeId) ?? [];
    list.push(item);
    byRecipe.set(item.recipeId, list);
  }
  return rows.map((r) => ({
    ...r,
    items: (byRecipe.get(r.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map(({ id, productId, quantity, unit, position }) => ({ id, productId, quantity, unit, position })),
  }));
}

export function listRecipes(): Recipe[] {
  const db = getDb();
  const rows = db.select().from(recipes).orderBy(desc(recipes.updatedAt)).all();
  if (!rows.length) return [];
  const items = db
    .select()
    .from(recipeItems)
    .where(inArray(recipeItems.recipeId, rows.map((r) => r.id)))
    .orderBy(asc(recipeItems.position))
    .all();
  return assemble(rows, items);
}

export function getRecipe(id: number): Recipe | null {
  const db = getDb();
  const row = db.select().from(recipes).where(eq(recipes.id, id)).get();
  if (!row) return null;
  const items = db.select().from(recipeItems).where(eq(recipeItems.recipeId, id)).all();
  return assemble([row], items)[0];
}

function writeItems(tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0], recipeId: number, items: LineItem[]) {
  tx.delete(recipeItems).where(eq(recipeItems.recipeId, recipeId)).run();
  if (!items.length) return;
  tx.insert(recipeItems)
    .values(items.map((item, position) => ({ ...item, recipeId, position })))
    .run();
}

function assertProductsExist(items: LineItem[]) {
  const ids = [...new Set(items.map((i) => i.productId))];
  if (getProductsByIds(ids).length !== ids.length) throw new NotFoundError("One or more products no longer exist.");
}

export function createRecipe(input: RecipeInput): Recipe {
  assertProductsExist(input.items);
  const db = getDb();
  const id = db.transaction((tx) => {
    const row = tx
      .insert(recipes)
      .values({ name: input.name, servings: input.servings, notes: input.notes ?? null })
      .returning({ id: recipes.id })
      .get();
    writeItems(tx, row.id, input.items);
    return row.id;
  });
  return getRecipe(id)!;
}

export function updateRecipe(id: number, input: RecipeInput): Recipe {
  assertProductsExist(input.items);
  const db = getDb();
  db.transaction((tx) => {
    const res = tx
      .update(recipes)
      .set({ name: input.name, servings: input.servings, notes: input.notes ?? null, updatedAt: new Date().toISOString() })
      .where(eq(recipes.id, id))
      .run();
    if (res.changes === 0) throw new NotFoundError("Recipe not found.");
    writeItems(tx, id, input.items);
  });
  return getRecipe(id)!;
}

export function deleteRecipe(id: number): void {
  getDb().delete(recipes).where(eq(recipes.id, id)).run();
}
