import clsx from "clsx";
import { ArrowUpRight, ChefHat, Clock, Crown, Dumbbell, Flame, Scale } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { ProductActions } from "@/components/product-actions";
import { daysLeft, MacroDonut, MacroLegend, OfferChip, ShelfTag, StoreBadge } from "@/components/ui";
import { effectivePrice, packagePrice, pieceAmount, valueMetrics } from "@/lib/domain/calc";
import { formatAmount, formatNumber, formatSek, perKgLabel } from "@/lib/domain/format";
import { getProduct, productUsage } from "@/lib/repo/products";
import { STORE_META } from "@/lib/stores";

async function load(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  return Number.isInteger(id) ? getProduct(id) : null;
}

export async function generateMetadata({ params }: PageProps<"/products/[id]">): Promise<Metadata> {
  await connection();
  const p = await load(params);
  return { title: p?.name ?? "Product" };
}

const IMAGE_HOSTS = ["assets.axfood.se", "handlaprivatkund.ica.se"];

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  await connection();
  const p = await load(params);
  if (!p) notFound();

  const usage = productUsage(p.id);
  const reg = valueMetrics(p, "regular");
  const mem = valueMetrics(p, "member");
  const meta = STORE_META[p.store];
  const piece = pieceAmount(p);
  const regular = effectivePrice(p, "regular").price;
  const member = effectivePrice(p, "member").price;
  const memberDeal = member < regular - 0.005;
  const unit = p.priceBasis === "kg" ? "/kg" : undefined;
  let imageOk = false;
  try {
    imageOk = !!p.imageUrl && IMAGE_HOSTS.includes(new URL(p.imageUrl).hostname);
  } catch {}

  return (
    <article className="animate-rise">
      <Link href="/products" className="text-sm font-medium text-muted hover:text-ink">
        ← Pantry
      </Link>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Image + hanging tags */}
        <div className={clsx("relative min-h-80 overflow-hidden rounded-[2rem] border border-line bg-white shadow-card", !imageOk && "stripes")}>
          {imageOk ? (
            <Image src={p.imageUrl!} alt={p.name} fill priority sizes="(min-width: 1024px) 520px, 90vw" className="object-contain p-12" />
          ) : (
            <div className="display absolute inset-0 grid place-items-center text-9xl font-bold text-line-strong">{p.name.slice(0, 1)}</div>
          )}
          <div className="absolute left-5 top-5">
            <StoreBadge store={p.store} />
          </div>
          <div className="absolute bottom-5 left-5 flex items-end gap-3">
            <ShelfTag value={regular} unit={unit} size="md" tilt={-3} was={memberDeal ? undefined : regular < p.price - 0.005 ? p.price : undefined} />
            {memberDeal && (
              <ShelfTag
                value={member}
                unit={unit}
                size="lg"
                variant="member"
                tilt={2}
                label={
                  <>
                    <Crown className="size-3" /> {meta.member}
                  </>
                }
              />
            )}
          </div>
        </div>

        {/* Facts */}
        <div className="flex flex-col gap-6">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted">
              {p.fetchedAt && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" />
                  Price checked {new Date(p.fetchedAt).toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              )}
              {p.url && (
                <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-ink hover:underline">
                  View at {meta.name} <ArrowUpRight className="size-3.5" />
                </a>
              )}
            </div>
            <h1 className="display text-4xl font-bold leading-[0.95] sm:text-5xl">{p.name}</h1>
            <p className="mt-3 text-ink-2">
              {[p.brand, p.packageSize ? formatAmount(p.packageSize, p.baseUnit) : "size unknown", p.pieces ? `${formatNumber(p.pieces)} pieces` : null]
                .filter(Boolean)
                .join(" · ")}
              {p.priceBasis === "kg" && p.packageSize && (
                <> · a typical piece costs ≈ <b className="num font-semibold">{formatSek(packagePrice(p, "regular"))}</b></>
              )}
            </p>
          </div>

          {p.offers.length > 0 && (
            <div className="space-y-2">
              {p.offers.map((o, i) => {
                const days = daysLeft(o.validUntil);
                return (
                  <div key={i} className={clsx("flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3", o.memberOnly ? "bg-member-soft" : "bg-tag/25")}>
                    <OfferChip offer={o} />
                    <span className="text-sm text-ink-2">
                      {o.memberOnly ? `Needs ${meta.member}` : "Everyone gets this"}
                      {o.minQuantity > 1 && ` · buy ${o.minQuantity}`}
                    </span>
                    {days != null && (
                      <span className={clsx("ml-auto text-xs font-semibold", days <= 2 ? "text-accent" : "text-muted")}>
                        {days === 0 ? "Ends today" : `${days} day${days === 1 ? "" : "s"} left`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <ValueTile icon={<Scale className="size-4" />} label={perKgLabel(p.baseUnit)} regular={reg.perKg} member={mem.perKg} />
            <ValueTile icon={<Flame className="size-4" />} label="per 100 kcal" regular={reg.per100kcal} member={mem.per100kcal} />
            <ValueTile icon={<Dumbbell className="size-4" />} label="per 10 g protein" regular={reg.per10gProtein} member={mem.per10gProtein} />
          </div>

          <div className="card flex flex-col items-center gap-6 p-6 sm:flex-row">
            {p.nutrition ? (
              <>
                <MacroDonut macros={p.nutrition} label={`kcal / 100${p.baseUnit}`} />
                <div className="w-full flex-1">
                  <div className="eyebrow mb-3">Per 100 {p.baseUnit} · share of energy</div>
                  <MacroLegend macros={p.nutrition} />
                  {piece != null && p.pieces != null && (
                    <p className="mt-3 text-xs text-muted">One piece ≈ {formatAmount(piece, p.baseUnit)}.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">No nutrition data from the store. Use Edit to add it from the package.</p>
            )}
          </div>

          {usage.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">Used in</span>
              {usage.map((r) => (
                <Link key={r.id} href={`/recipes/${r.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-medium hover:border-ink">
                  <ChefHat className="size-3.5" /> {r.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <ProductActions product={p} />
      </div>
    </article>
  );
}

function ValueTile({ icon, label, regular, member }: { icon: ReactNode; label: string; regular: number | null; member: number | null }) {
  const better = regular != null && member != null && member < regular - 0.005;
  return (
    <div className="rounded-3xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-muted">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 font-price text-3xl font-extrabold leading-none">{formatSek(regular, { suffix: false })}</div>
      <div className="mt-1 text-xs text-muted">kr regular</div>
      {better && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-member-soft px-2 py-0.5 text-xs font-semibold text-member">
          <Crown className="size-3" /> {formatSek(member, { suffix: false })}
        </div>
      )}
    </div>
  );
}
