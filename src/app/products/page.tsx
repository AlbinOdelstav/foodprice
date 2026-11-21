import { PenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AddProduct } from "@/components/add-product";
import { ProductGrid } from "@/components/product-grid";
import { PageHeader } from "@/components/ui";
import { listProducts } from "@/lib/repo/products";

export const metadata: Metadata = { title: "Pantry" };

export default async function ProductsPage() {
  await connection();
  const products = listProducts();
  return (
    <>
      <PageHeader
        eyebrow={`${products.length} product${products.length === 1 ? "" : "s"}`}
        title="Pantry"
        lede="Everything you've priced. Sort by what you actually get for your money: protein, calories or weight."
      >
        <Link href="/products/new" className="btn-ghost">
          <PenLine className="size-4" /> Add by hand
        </Link>
      </PageHeader>
      <div className="relative z-20 mb-10 max-w-3xl">
        <AddProduct />
      </div>
      <ProductGrid products={products} />
    </>
  );
}
