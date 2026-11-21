import type { Metadata } from "next";
import { connection } from "next/server";
import { RecipeEditor } from "@/components/recipe-editor";
import { PageHeader } from "@/components/ui";
import { listProducts } from "@/lib/repo/products";

export const metadata: Metadata = { title: "Calculator" };

export default async function CalculatorPage() {
  await connection();
  return (
    <>
      <PageHeader
        eyebrow="Scratchpad"
        title="Calculator"
        lede="Throw things in the basket and watch the receipt: what you use, what the till charges for whole packages, and what a membership saves. It stays in this browser until you save it."
      />
      <RecipeEditor products={listProducts()} />
    </>
  );
}
