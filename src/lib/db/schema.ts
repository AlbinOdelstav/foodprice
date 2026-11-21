import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { Macros, Offer, OverridableField } from "@/lib/domain/types";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
};

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    store: text("store", { enum: ["willys", "ica", "manual"] }).notNull(),
    storeProductId: text("store_product_id").notNull(),
    storeLocation: text("store_location").notNull().default(""),
    url: text("url"),
    name: text("name").notNull(),
    brand: text("brand"),
    imageUrl: text("image_url"),
    baseUnit: text("base_unit", { enum: ["g", "ml"] }).notNull().default("g"),
    packageSize: real("package_size"),
    pieces: real("pieces"),
    pieceSize: real("piece_size"),
    priceBasis: text("price_basis", { enum: ["package", "kg"] }).notNull().default("package"),
    price: real("price").notNull(),
    offers: text("offers", { mode: "json" }).$type<Offer[]>().notNull().default(sql`'[]'`),
    nutrition: text("nutrition", { mode: "json" }).$type<Macros | null>(),
    overrides: text("overrides", { mode: "json" }).$type<OverridableField[]>().notNull().default(sql`'[]'`),
    fetchedAt: text("fetched_at"),
    ...timestamps,
  },
  (t) => [uniqueIndex("products_store_ref").on(t.store, t.storeProductId, t.storeLocation)],
);

export const recipes = sqliteTable("recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  servings: real("servings").notNull().default(1),
  notes: text("notes"),
  ...timestamps,
});

export const recipeItems = sqliteTable(
  "recipe_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    position: integer("position").notNull().default(0),
    quantity: real("quantity").notNull(),
    unit: text("unit", { enum: ["g", "kg", "ml", "dl", "l", "st", "pkg"] }).notNull(),
  },
  (t) => [index("recipe_items_recipe").on(t.recipeId), index("recipe_items_product").on(t.productId)],
);
