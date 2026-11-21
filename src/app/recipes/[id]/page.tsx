import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { RecipeEditor } from "@/components/recipe-editor";
import { listProducts } from "@/lib/repo/products";
import { getRecipe } from "@/lib/repo/recipes";

async function load(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  return Number.isInteger(id) ? getRecipe(id) : null;
}

export async function generateMetadata({ params }: PageProps<"/recipes/[id]">): Promise<Metadata> {
  await connection();
  return { title: (await load(params))?.name ?? "Recipe" };
}

export default async function RecipePage({ params }: PageProps<"/recipes/[id]">) {
  await connection();
  const recipe = await load(params);
  if (!recipe) notFound();
  return (
    <>
      <Link href="/recipes" className="text-sm text-muted hover:text-ink">
        ← Recipes
      </Link>
      <div className="mt-4">
        {/* key resets editor state when navigating between recipes or after a save */}
        <RecipeEditor key={`${recipe.id}-${recipe.updatedAt}`} products={listProducts()} recipe={recipe} />
      </div>
    </>
  );
}
