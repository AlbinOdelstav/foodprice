import { ChefHat, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { RecipeCard } from "@/components/recipe-card";
import { EmptyState, PageHeader } from "@/components/ui";
import { summarizeRecipe } from "@/lib/domain/summary";
import { listProducts } from "@/lib/repo/products";
import { listRecipes } from "@/lib/repo/recipes";

export const metadata: Metadata = { title: "Recipes" };

export default async function RecipesPage() {
  await connection();
  const byId = new Map(listProducts().map((p) => [p.id, p]));
  const summaries = listRecipes().map((r) => summarizeRecipe(r, byId));

  return (
    <>
      <PageHeader eyebrow={`${summaries.length} saved`} title="Recipes" lede="Every recipe costed per portion, with and without a membership, and counted in calories and macros.">
        <Link href="/calculator" className="btn-primary">
          <Plus className="size-4" /> New recipe
        </Link>
      </PageHeader>
      {summaries.length === 0 ? (
        <EmptyState icon={<ChefHat className="size-6" />} title="No recipes yet">
          Build one in the <Link href="/calculator" className="underline">calculator</Link> and hit “Save as recipe”.
        </EmptyState>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map((s, i) => (
            <li key={s.recipe.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
              <RecipeCard summary={s} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
