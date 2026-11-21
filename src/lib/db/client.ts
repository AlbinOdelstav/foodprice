import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { __foodpriceDb?: Db };

function open(): Db {
  // Paths are resolved at runtime from the working directory; keep the bundler from tracing them.
  const root = /* turbopackIgnore: true */ process.cwd();
  const file = path.resolve(root, process.env.DATABASE_PATH ?? "data/foodprice.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(root, "drizzle") });
  return db;
}

/** Lazily opened, migrated singleton (survives dev hot reloads). */
export function getDb(): Db {
  globalForDb.__foodpriceDb ??= open();
  return globalForDb.__foodpriceDb;
}
