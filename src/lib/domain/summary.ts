import { calcLine, calcTotals, type Totals } from "./calc";
import type { Product, Recipe } from "./types";

export interface RecipeSummary {
  recipe: Recipe;
  totals: Totals;
  perServing: { regular: number; member: number; kcal: number; protein: number };
  images: (string | null)[];
}

export function summarizeRecipe(recipe: Recipe, byId: Map<number, Product>): RecipeSummary {
  const lines = recipe.items.flatMap((item) => {
    const product = byId.get(item.productId);
    return product ? [{ product, result: calcLine(product, item) }] : [];
  });
  const totals = calcTotals(lines.map((l) => l.result));
  const s = recipe.servings > 0 ? recipe.servings : 1;
  return {
    recipe,
    totals,
    perServing: {
      regular: totals.cost.regular.used / s,
      member: totals.cost.member.used / s,
      kcal: totals.macros.kcal / s,
      protein: totals.macros.protein / s,
    },
    images: lines.map((l) => l.product.imageUrl),
  };
}
