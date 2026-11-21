"use client";

import { Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api/client";
import type { Product } from "@/lib/domain/types";
import { ProductForm } from "./product-form";
import { useToast } from "./toast";

export function ProductActions({ product }: { product: Product }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<"refresh" | "delete" | "reset" | null>(null);
  const [editing, setEditing] = useState(false);

  async function refresh() {
    setBusy("refresh");
    try {
      await api(`/api/products/${product.id}/refresh`, { method: "POST" });
      toast("success", "Price and offers updated");
      router.refresh();
    } catch (err) {
      toast("error", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function resetOverrides() {
    setBusy("reset");
    try {
      await api(`/api/products/${product.id}`, { method: "PATCH", body: { clearOverrides: true } });
      await api(`/api/products/${product.id}/refresh`, { method: "POST" });
      toast("success", "Back to the store's values");
      router.refresh();
    } catch (err) {
      toast("error", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm(`Delete ${product.name} from your pantry?`)) return;
    setBusy("delete");
    try {
      await api(`/api/products/${product.id}`, { method: "DELETE" });
      toast("success", "Deleted");
      router.push("/products");
      router.refresh();
    } catch (err) {
      toast("error", errorMessage(err));
      setBusy(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {product.store !== "manual" && (
          <button className="btn-ghost" onClick={refresh} disabled={busy != null}>
            {busy === "refresh" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Refresh price
          </button>
        )}
        <button className="btn-ghost" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
          <Pencil className="size-4" /> Edit
        </button>
        {product.overrides.length > 0 && (
          <button className="btn-ghost" onClick={resetOverrides} disabled={busy != null}>
            {busy === "reset" && <Loader2 className="size-4 animate-spin" />}
            Reset {product.overrides.length} override{product.overrides.length > 1 ? "s" : ""}
          </button>
        )}
        <button className="btn-danger" onClick={remove} disabled={busy != null}>
          {busy === "delete" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Delete
        </button>
      </div>
      {editing && (
        <div className="card animate-rise mt-6 p-5 sm:p-6">
          <ProductForm product={product} onDone={() => setEditing(false)} />
        </div>
      )}
    </>
  );
}
