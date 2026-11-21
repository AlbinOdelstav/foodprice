import type { NextRequest } from "next/server";
import { handle, parseId, productPatchSchema, readJson } from "@/lib/api/server";
import { deleteProduct, getProduct, NotFoundError, updateProduct } from "@/lib/repo/products";

export const GET = handle(async (_req: NextRequest, ctx: RouteContext<"/api/products/[id]">) => {
  const product = getProduct(parseId((await ctx.params).id));
  if (!product) throw new NotFoundError("Product not found.");
  return Response.json(product);
});

export const PATCH = handle(async (request: NextRequest, ctx: RouteContext<"/api/products/[id]">) => {
  const id = parseId((await ctx.params).id);
  const patch = await readJson(request, productPatchSchema);
  return Response.json(updateProduct(id, patch));
});

export const DELETE = handle(async (_req: NextRequest, ctx: RouteContext<"/api/products/[id]">) => {
  deleteProduct(parseId((await ctx.params).id));
  return new Response(null, { status: 204 });
});
