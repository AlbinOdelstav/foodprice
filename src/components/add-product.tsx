"use client";

import clsx from "clsx";
import { CornerDownLeft, Link2, Loader2, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { api, ApiError, errorMessage } from "@/lib/api/client";
import type { Product } from "@/lib/domain/types";
import type { StoreSearchHit } from "@/lib/stores/willys";
import { useToast } from "./toast";
import { OfferChip, ProductThumb, ShelfTag, StoreBadge } from "./ui";

const looksLikeUrl = (s: string) => /^https?:\/\/|^www\.|\.se\//i.test(s.trim());

export function AddProduct({
  onAdded,
  variant = "default",
  autoFocus,
  placeholder = "Paste a Willys or ICA link, or search Willys…",
}: {
  onAdded?: (product: Product) => void;
  variant?: "default" | "hero";
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const listId = useId();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; blocked?: boolean } | null>(null);
  const [hits, setHits] = useState<StoreSearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const isUrl = looksLikeUrl(value);
  const searchable = !isUrl && value.trim().length >= 2;

  // Debounced Willys search for plain text.
  useEffect(() => {
    const q = value.trim();
    if (isUrl || q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setHits(data);
        setOpen(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setHits([]);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value, isUrl]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function importUrl(url: string, key: string) {
    setBusy(key);
    setError(null);
    try {
      const { product, created } = await api<{ product: Product; created: boolean }>("/api/products/import", {
        body: { url: url.startsWith("http") ? url : `https://${url}` },
      });
      toast("success", `${created ? "Added" : "Updated"} ${product.name}`);
      setValue("");
      setHits(null);
      setOpen(false);
      if (onAdded) onAdded(product);
      else router.refresh();
    } catch (err) {
      const blocked = err instanceof ApiError && err.code === "blocked";
      setError({ message: errorMessage(err), blocked: blocked && url.includes("ica.se") });
    } finally {
      setBusy(null);
    }
  }

  const hero = variant === "hero";
  return (
    <div ref={boxRef} className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (isUrl) importUrl(value.trim(), "url");
          else if (searchable && hits?.length) setOpen(true);
        }}
        className={clsx(
          "flex items-center gap-3 rounded-2xl bg-surface pl-4 pr-2 transition focus-within:ring-4",
          hero ? "h-16 shadow-lg focus-within:ring-tag/50" : "h-14 border border-line shadow-card focus-within:ring-tag/40",
        )}
      >
        <span
          className={clsx(
            "grid size-8 shrink-0 place-items-center rounded-xl transition",
            isUrl ? "bg-tag text-tag-ink" : "bg-bg-2 text-ink-2",
          )}
        >
          {isUrl ? <Link2 className="size-4" /> : <Search className="size-4" />}
        </span>
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onFocus={() => searchable && hits && setOpen(true)}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label="Product link or search"
          aria-controls={listId}
          aria-expanded={open}
          role="combobox"
          className={clsx("min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted", hero ? "text-[17px]" : "text-[15px]")}
        />
        {searchable && searching && <Loader2 className="size-4 animate-spin text-muted" />}
        <button type="submit" disabled={!value.trim() || busy != null} className={clsx(isUrl ? "btn-primary" : "btn-ghost", "shrink-0")}>
          {busy === "url" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isUrl ? (
            <Plus className="size-4" />
          ) : (
            <CornerDownLeft className="size-4" />
          )}
          <span className="hidden sm:inline">{isUrl ? "Add product" : "Search"}</span>
        </button>
      </form>

      {error && (
        <p className={clsx("mt-3 rounded-xl px-4 py-2 text-sm", hero ? "bg-accent text-white" : "bg-accent-soft text-accent")} role="alert">
          {error.message}{" "}
          {error.blocked && (
            <Link href="/ica-helper" className="font-semibold underline underline-offset-2">
              Use the ICA browser helper →
            </Link>
          )}
        </p>
      )}

      {open && searchable && hits && (
        <div
          id={listId}
          role="listbox"
          className="animate-rise absolute inset-x-0 top-full z-40 mt-2 max-h-[62vh] overflow-y-auto rounded-3xl border border-line bg-surface p-2 text-ink shadow-lg"
        >
          <div className="flex items-center gap-2 px-3 pb-2 pt-2">
            <StoreBadge store="willys" />
            <span className="eyebrow">{hits.length} results</span>
          </div>
          {hits.length === 0 && <p className="px-3 py-6 text-sm text-muted">Nothing found. Try another word, or paste a link.</p>}
          {hits.map((h) => {
            const weighed = /kg/i.test(h.priceUnit);
            const memberOffer = h.offers.find((o) => o.memberOnly && o.price != null);
            return (
              <div key={h.storeProductId} role="option" aria-selected={false} className="group flex items-center gap-3 rounded-2xl p-2 hover:bg-surface-2">
                <ProductThumb src={h.imageUrl} alt={h.name} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{h.name}</div>
                  <div className="truncate text-xs text-muted">{[h.brand, h.size].filter(Boolean).join(" · ")}</div>
                  {h.offers.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {h.offers.slice(0, 2).map((o, i) => (
                        <OfferChip key={i} offer={o} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <ShelfTag value={h.price} unit={weighed ? "/kg" : undefined} size="xs" />
                  {memberOffer && <ShelfTag value={memberOffer.price} variant="member" size="xs" />}
                </div>
                <button
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-bg transition hover:scale-105 disabled:opacity-40"
                  disabled={busy != null}
                  onClick={() => importUrl(`https://www.willys.se/produkt/${h.storeProductId}`, h.storeProductId)}
                  aria-label={`Add ${h.name}`}
                >
                  {busy === h.storeProductId ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
