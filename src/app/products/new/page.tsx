import type { Metadata } from "next";
import Link from "next/link";
import { ProductForm } from "@/components/product-form";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Add product" };

export default function NewProductPage() {
  return (
    <>
      <Link href="/products" className="text-sm font-medium text-muted hover:text-ink">
        ← Pantry
      </Link>
      <div className="mt-4">
        <PageHeader
          eyebrow="Manual entry"
          title="Add a product by hand"
          lede="For anything we can't read yet: Lidl, the market stall, your neighbour's eggs. Fill in what you know; nutrition is optional."
        />
      </div>
      <div className="card p-6 sm:p-8">
        <ProductForm />
      </div>
    </>
  );
}
