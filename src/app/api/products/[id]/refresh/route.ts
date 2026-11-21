import type { NextRequest } from "next/server";
import { handle, parseId } from "@/lib/api/server";
import { refreshProduct } from "@/lib/services/products";

export const POST = handle(async (_req: NextRequest, ctx: RouteContext<"/api/products/[id]/refresh">) => {
  return Response.json(await refreshProduct(parseId((await ctx.params).id)));
});
