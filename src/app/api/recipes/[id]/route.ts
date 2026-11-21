import type { NextRequest } from "next/server";
import { handle, parseId, readJson, recipeSchema } from "@/lib/api/server";
import { NotFoundError } from "@/lib/repo/products";
import { deleteRecipe, getRecipe, updateRecipe } from "@/lib/repo/recipes";

export const GET = handle(async (_req: NextRequest, ctx: RouteContext<"/api/recipes/[id]">) => {
  const recipe = getRecipe(parseId((await ctx.params).id));
  if (!recipe) throw new NotFoundError("Recipe not found.");
  return Response.json(recipe);
});

export const PUT = handle(async (request: NextRequest, ctx: RouteContext<"/api/recipes/[id]">) => {
  const id = parseId((await ctx.params).id);
  return Response.json(updateRecipe(id, await readJson(request, recipeSchema)));
});

export const DELETE = handle(async (_req: NextRequest, ctx: RouteContext<"/api/recipes/[id]">) => {
  deleteRecipe(parseId((await ctx.params).id));
  return new Response(null, { status: 204 });
});
