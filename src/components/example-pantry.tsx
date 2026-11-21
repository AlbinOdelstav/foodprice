"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useToast } from "./toast";

/** Real Willys products: a weighed cheese, staples, and a couple with current offers. */
const EXAMPLES = [
  "https://www.willys.se/produkt/Hushallsost-26procent-101197478_KG",
  "https://www.willys.se/produkt/101833307_ST",
  "https://www.willys.se/produkt/101222356_ST",
  "https://www.willys.se/produkt/101240218_ST",
  "https://www.willys.se/produkt/101205823_ST",
  "https://www.willys.se/produkt/101511521_ST",
];

export function ExamplePantryButton({ className = "btn-tag" }: { className?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [progress, setProgress] = useState<number | null>(null);

  async function load() {
    let ok = 0;
    for (let i = 0; i < EXAMPLES.length; i++) {
      setProgress(i);
      try {
        await api("/api/products/import", { body: { url: EXAMPLES[i] } });
        ok++;
      } catch {}
    }
    setProgress(null);
    toast(ok ? "success" : "error", ok ? `Added ${ok} example products from Willys` : "Couldn't reach Willys right now.");
    router.refresh();
  }

  return (
    <button className={className} onClick={load} disabled={progress != null}>
      {progress != null ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      {progress != null ? `Fetching ${progress + 1} of ${EXAMPLES.length}…` : "Load an example pantry"}
    </button>
  );
}
