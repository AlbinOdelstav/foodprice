"use client";

import clsx from "clsx";
import { Crown, Search, ShoppingBasket } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { effectivePrice, valueMetrics } from "@/lib/domain/calc";
import { formatAmount, formatNumber, formatSek, perKgLabel } from "@/lib/domain/format";
import type { PriceTier, Product, StoreId } from "@/lib/domain/types";
import { ExamplePantryButton } from "./example-pantry";
import { EmptyState, MacroBar, OfferChip, ShelfTag, StoreBadge } from "./ui";

type SortKey = "recent" | "name" | "perKg" | "protein" | "energy";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "protein", label: "Cheapest protein" },
  { key: "energy", label: "Cheapest kcal" },
  { key: "perKg", label: "Price / kg" },
  { key: "name", label: "A–Ö" },
];

export function TierToggle({ tier, onChange }: { tier: PriceTier; onChange: (t: PriceTier) => void }) {
  return (
    <div className="inline-flex rounded-full border border-line bg-surface p-1 text-sm shadow-sm" role="radiogroup" aria-label="Price tier">
      {(["regular", "member"] as const).map((t) => (
        <button
          key={t}
          role="radio"
          aria-checked={tier === t}
          onClick={() => onChange(t)}
          className={clsx(
            "flex h-8 items-center gap-1.5 rounded-full px-3.5 font-semibold transition",
            tier === t ? (t === "member" ? "bg-member text-member-ink" : "bg-tag text-tag-ink") : "text-muted hover:text-ink",
          )}
        >
          {t === "member" && <Crown className="size-3.5" />}
          {t === "regular" ? "Regular" : "Member"}
        </button>
      ))}
    </div>
  );
}

const IMAGE_HOSTS = ["assets.axfood.se", "handlaprivatkund.ica.se"];

export function ProductGrid({ products }: { products: Product[] }) {
  const [tier, setTier] = useState<PriceTier>("regular");
  const [store, setStore] = useState<StoreId | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products
      .filter((p) => store === "all" || p.store === store)
      .filter((p) => !q || `${p.name} ${p.brand ?? ""}`.toLowerCase().includes(q))
      .map((p) => ({ p, m: valueMetrics(p, tier) }));
    const nullsLast = (v: number | null) => v ?? Number.POSITIVE_INFINITY;
    list.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.p.name.localeCompare(b.p.name, "sv");
        case "perKg":
          return nullsLast(a.m.perKg) - nullsLast(b.m.perKg);
        case "protein":
          return nullsLast(a.m.per10gProtein) - nullsLast(b.m.per10gProtein);
        case "energy":
          return nullsLast(a.m.per100kcal) - nullsLast(b.m.per100kcal);
        default:
          return b.p.updatedAt.localeCompare(a.p.updatedAt);
      }
    });
    return list;
  }, [products, tier, store, query, sort]);

  if (!products.length) {
    return (
      <EmptyState icon={<ShoppingBasket className="size-6" />} title="Your pantry is empty" action={<ExamplePantryButton />}>
        Paste a product link from Willys or ICA above, or search Willys by name. Everything you add lands here with
        price, member offers and macros.
      </EmptyState>
    );
  }

  const stores = Array.from(new Set(products.map((p) => p.store)));
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            className="input h-10 w-56 rounded-full pl-10"
            placeholder="Filter pantry"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter products"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Sort by">
          {SORTS.map((s) => (
            <button
              key={s.key}
              role="radio"
              aria-checked={sort === s.key}
              onClick={() => setSort(s.key)}
              className={clsx(
                "h-8 rounded-full px-3 text-xs font-semibold transition",
                sort === s.key ? "bg-ink text-bg" : "border border-line bg-surface text-ink-2 hover:border-line-strong",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {stores.length > 1 && (
          <select className="input h-8 w-auto rounded-full text-xs font-semibold" value={store} onChange={(e) => setStore(e.target.value as StoreId | "all")} aria-label="Store">
            <option value="all">All stores</option>
            {stores.map((s) => (
              <option key={s} value={s}>
                {s === "ica" ? "ICA" : s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        )}
        <div className="ml-auto">
          <TierToggle tier={tier} onChange={setTier} />
        </div>
      </div>

      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ p, m }, i) => (
          <li key={p.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
            <ProductCard product={p} tier={tier} metrics={m} rank={sort === "protein" || sort === "energy" || sort === "perKg" ? i + 1 : null} />
          </li>
        ))}
      </ul>
      {!rows.length && <p className="py-12 text-center text-sm text-muted">No products match.</p>}
    </div>
  );
}

function ProductCard({
  product: p,
  tier,
  metrics: m,
  rank,
}: {
  product: Product;
  tier: PriceTier;
  metrics: ReturnType<typeof valueMetrics>;
  rank: number | null;
}) {
  const regular = effectivePrice(p, "regular").price;
  const member = effectivePrice(p, "member").price;
  const memberDeal = member < regular - 0.005;
  const unit = p.priceBasis === "kg" ? "/kg" : undefined;
  let imageOk = false;
  try {
    imageOk = !!p.imageUrl && IMAGE_HOSTS.includes(new URL(p.imageUrl).hostname);
  } catch {}

  return (
    <Link
      href={`/products/${p.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className={clsx("relative aspect-[5/4] bg-white", !imageOk && "stripes")}>
        {imageOk ? (
          <Image
            src={p.imageUrl!}
            alt={p.name}
            fill
            sizes="(min-width: 1280px) 360px, (min-width: 640px) 45vw, 90vw"
            className="object-contain p-8 transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="display absolute inset-0 grid place-items-center text-7xl font-bold text-line-strong">{p.name.slice(0, 1)}</div>
        )}
        <div className="absolute left-4 top-4 flex items-center gap-1.5">
          <StoreBadge store={p.store} />
          {rank != null && rank <= 3 && (
            <span className="inline-flex h-5 items-center rounded-full bg-ink px-2 text-[10px] font-bold text-bg">#{rank}</span>
          )}
        </div>
        {p.offers.length > 0 && (
          <div className="absolute right-4 top-4 flex max-w-[60%] flex-col items-end gap-1">
            {p.offers.slice(0, 2).map((o, i) => (
              <OfferChip key={i} offer={o} />
            ))}
          </div>
        )}
        <div className="absolute -bottom-5 left-4 flex items-end gap-2">
          <ShelfTag value={regular} unit={unit} size="sm" tilt={-3} was={regular < p.price - 0.005 ? p.price : undefined} className={clsx(tier === "member" && memberDeal && "opacity-60")} />
          {memberDeal && (
            <ShelfTag
              value={member}
              unit={unit}
              size="sm"
              variant="member"
              tilt={2}
              label={
                <>
                  <Crown className="size-2.5" /> Member
                </>
              }
            />
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-9">
        <h3 className="display line-clamp-2 text-lg font-bold leading-tight">{p.name}</h3>
        <p className="mt-1 truncate text-xs text-muted">
          {[p.brand, p.packageSize ? formatAmount(p.packageSize, p.baseUnit) : null].filter(Boolean).join(" · ")}
        </p>

        <dl className="mt-auto grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-line pt-px text-center">
          <Metric label={perKgLabel(p.baseUnit)} value={formatSek(m.perKg, { suffix: false })} />
          <Metric label="kr/10g prot." value={formatSek(m.per10gProtein, { suffix: false })} highlight="text-protein" />
          <Metric label="kcal/100g" value={formatNumber(p.nutrition?.kcal)} />
        </dl>
        {p.nutrition && <MacroBar macros={p.nutrition} className="mt-3" />}
      </div>
    </Link>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="flex flex-col-reverse bg-surface-2 px-2 py-2.5">
      <dt className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className={clsx("num text-sm font-semibold", highlight)}>{value}</dd>
    </div>
  );
}
