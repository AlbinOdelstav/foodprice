import "server-only";
import { z } from "zod";
import { LINE_UNITS } from "@/lib/domain/types";
import { ConflictError, NotFoundError } from "@/lib/repo/products";
import { StoreError } from "@/lib/stores";

const macros = z.object({
  kcal: z.number().min(0).max(1000),
  protein: z.number().min(0).max(100),
  fat: z.number().min(0).max(100),
  carbs: z.number().min(0).max(100),
});

const offer = z.object({
  label: z.string().trim().min(1).max(120),
  memberOnly: z.boolean(),
  price: z.number().nonnegative().nullable(),
  minQuantity: z.number().int().min(1).max(99),
  validUntil: z.string().datetime().nullable(),
});

const positive = z.number().positive().max(1_000_000);

export const productFields = z.object({
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(120).nullable(),
  baseUnit: z.enum(["g", "ml"]),
  packageSize: positive.nullable(),
  pieces: positive.nullable(),
  pieceSize: positive.nullable(),
  price: z.number().nonnegative().max(100_000),
  priceBasis: z.enum(["package", "kg"]),
  nutrition: macros.nullable(),
});

export const manualProductSchema = productFields.extend({
  url: z.string().url().max(500).nullable().default(null),
  imageUrl: z.string().url().max(500).nullable().default(null),
  offers: z.array(offer).max(10).default([]),
});

export const productPatchSchema = productFields.partial().extend({ clearOverrides: z.boolean().optional() });

export const importSchema = z.object({ url: z.string().trim().min(1).max(2000) });

export const recipeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  servings: z.number().positive().max(1000),
  notes: z.string().max(5000).nullable().optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().positive().max(1_000_000),
        unit: z.enum(LINE_UNITS),
      }),
    )
    .max(200),
});

export const idsSchema = z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) });

export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundError("Not found.");
  return id;
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  // Requiring JSON blocks simple cross-site form posts against this local API.
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new BadRequest("Expected a JSON body.");
  }
  const body = await request.json().catch(() => {
    throw new BadRequest("Invalid JSON.");
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new BadRequest(`${issue.path.join(".") || "body"}: ${issue.message}`);
  }
  return parsed.data;
}

export class BadRequest extends Error {}

const STORE_STATUS: Record<StoreError["code"], number> = {
  "unsupported-url": 400,
  "not-found": 404,
  blocked: 503,
  upstream: 502,
  parse: 502,
};

/** Wrap a route handler so known errors become JSON `{ error, code }` responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response> | Response) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof StoreError) {
        return Response.json({ error: err.message, code: err.code }, { status: STORE_STATUS[err.code] });
      }
      if (err instanceof BadRequest) return Response.json({ error: err.message }, { status: 400 });
      if (err instanceof NotFoundError) return Response.json({ error: err.message }, { status: 404 });
      if (err instanceof ConflictError) return Response.json({ error: err.message }, { status: 409 });
      console.error(err);
      return Response.json({ error: "Something went wrong." }, { status: 500 });
    }
  };
}
