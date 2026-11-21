import { handle, readJson, recipeSchema } from "@/lib/api/server";
import { createRecipe, listRecipes } from "@/lib/repo/recipes";

export const GET = handle(async () => Response.json(listRecipes()));

export const POST = handle(async (request: Request) => {
  const input = await readJson(request, recipeSchema);
  return Response.json(createRecipe(input), { status: 201 });
});
