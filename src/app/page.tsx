import { ArrowRight, ChefHat, Crown, Dumbbell, Flame, Package, Percent, ShoppingBasket } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { AddProduct } from "@/components/add-product";
import { ExamplePantryButton } from "@/components/example-pantry";
import { RecipeCard } from "@/components/recipe-card";
import { daysLeft, EmptyState, OfferChip, ProductThumb, ShelfTag, StatTile, StoreBadge } from "@/components/ui";
import { effectivePrice, isOfferActive, packagePrice, valueMetrics } from "@/lib/domain/calc";
import { formatNumber, formatSek } from "@/lib/domain/format";
import { summarizeRecipe } from "@/lib/domain/summary";
import type { Product } from "@/lib/domain/types";
import { listProducts } from "@/lib/repo/products";
import { listRecipes } from "@/lib/repo/recipes";

export default async function Home() {
  await connection();
  const products = listProducts();
  const byId = new Map(products.map((p) => [p.id, p]));
  const allRecipes = listRecipes();
  const recipes = allRecipes.slice(0, 3).map((r) => summarizeRecipe(r, byId));

  const onOffer = products
    .map((p) => ({ p, offer: p.offers.find((o) => o.price != null && isOfferActive(o)) }))
    .filter((x): x is { p: Product; offer: NonNullable<typeof x.offer> } => x.offer != null)
    .sort((a, b) => (a.offer.validUntil ?? "9").localeCompare(b.offer.validUntil ?? "9"));

  const memberSavings = products
    .map((p) => {
      const reg = packagePrice(p, "regular");
      const mem = packagePrice(p, "member");
      return reg && mem && mem < reg ? 1 - mem / reg : null;
    })
    .filter((x): x is number => x != null);
  const avgMemberSaving = memberSavings.length ? memberSavings.reduce((a, b) => a + b, 0) / memberSavings.length : null;

  const proteinRanking = products
    .map((p) => ({ p, per10: valueMetrics(p, "regular").per10gProtein }))
    .filter((x): x is { p: Product; per10: number } => x.per10 != null)
    .sort((a, b) => a.per10 - b.per10)
    .slice(0, 6);
  const cheapestEnergy = products
    .map((p) => ({ p, v: valueMetrics(p, "regular").per100kcal }))
    .filter((x): x is { p: Product; v: number } => x.v != null)
    .sort((a, b) => a.v - b.v)[0];

  return (
    <>
      <Hero products={products} />

      {products.length === 0 ? (
        <div className="mt-10">
          <EmptyState icon={<ShoppingBasket className="size-6" />} title="Nothing on the shelf yet" action={<ExamplePantryButton />}>
            Paste a product link above, search Willys by name — or load six real products to see how everything works.
          </EmptyState>
        </div>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile tone="dark" label="In your pantry" value={products.length} hint="products tracked" icon={<Package className="size-4" />} />
            <StatTile tone="tag" label="On offer now" value={onOffer.length} hint={`${onOffer.filter((o) => o.offer.memberOnly).length} member-only`} icon={<Percent className="size-4" />} />
            <StatTile
              tone="member"
              label="Member saves"
              value={avgMemberSaving != null ? `${Math.round(avgMemberSaving * 100)}%` : "–"}
              hint={memberSavings.length ? `average across ${memberSavings.length} deals` : "no member deals right now"}
              icon={<Crown className="size-4" />}
            />
            <StatTile label="Recipes" value={allRecipes.length} hint="costed & counted" icon={<ChefHat className="size-4" />} />
          </section>

          <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div className="card p-6">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="display text-2xl font-bold">Protein per krona</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-protein/10 px-2.5 py-1 text-xs font-semibold text-protein">
                  <Dumbbell className="size-3.5" /> best value first
                </span>
              </div>
              <p className="mb-5 text-sm text-muted">Grams of protein you get for 10 kr, at regular price.</p>
              {proteinRanking.length ? (
                <ProteinChart rows={proteinRanking} />
              ) : (
                <p className="text-sm text-muted">Add products with nutrition data to see this.</p>
              )}
              {cheapestEnergy && (
                <Link
                  href={`/products/${cheapestEnergy.p.id}`}
                  className="mt-6 flex items-center gap-3 rounded-2xl bg-accent-soft p-3 text-sm transition hover:brightness-95"
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-accent text-white">
                    <Flame className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    Cheapest calories: <b className="font-semibold">{cheapestEnergy.p.name}</b>
                  </span>
                  <span className="num font-semibold">{formatSek(cheapestEnergy.v)} / 100 kcal</span>
                </Link>
              )}
            </div>

            <div className="card flex flex-col p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="display text-2xl font-bold">On offer now</h2>
                <Link href="/products" className="text-sm font-medium text-ink-2 hover:text-ink">
                  Pantry →
                </Link>
              </div>
              {onOffer.length ? (
                <ul className="-mx-2 flex-1 space-y-1">
                  {onOffer.slice(0, 5).map(({ p, offer }) => {
                    const days = daysLeft(offer.validUntil);
                    const deal = effectivePrice(p, offer.memberOnly ? "member" : "regular").price;
                    return (
                      <li key={p.id}>
                        <Link href={`/products/${p.id}`} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-surface-2">
                          <ProductThumb src={p.imageUrl} alt={p.name} size={48} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">{p.name}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <OfferChip offer={offer} />
                              {days != null && (
                                <span className={days <= 2 ? "text-xs font-semibold text-accent" : "text-xs text-muted"}>
                                  {days === 0 ? "ends today" : `${days} day${days === 1 ? "" : "s"} left`}
                                </span>
                              )}
                            </div>
                          </div>
                          <ShelfTag
                            value={deal}
                            unit={p.priceBasis === "kg" ? "/kg" : undefined}
                            variant={offer.memberOnly ? "member" : "regular"}
                            size="sm"
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="stripes grid flex-1 place-items-center rounded-2xl p-8 text-center text-sm text-muted">
                  No offers on your products this week.
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <section className="mt-12">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="display text-3xl font-bold">Recent recipes</h2>
          <Link href="/recipes" className="text-sm font-medium text-ink-2 hover:text-ink">
            All recipes →
          </Link>
        </div>
        {recipes.length ? (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((s) => (
              <li key={s.recipe.id}>
                <RecipeCard summary={s} />
              </li>
            ))}
          </ul>
        ) : (
          <Link
            href="/calculator"
            className="group flex items-center gap-5 rounded-3xl border-2 border-dashed border-line-strong p-6 transition hover:border-ink hover:bg-surface"
          >
            <span className="grid size-14 rotate-[-6deg] place-items-center rounded-2xl bg-member text-member-ink shadow-card transition group-hover:rotate-0">
              <ChefHat className="size-6" />
            </span>
            <div className="flex-1">
              <div className="display text-xl font-bold">Cost your first recipe</div>
              <p className="text-sm text-ink-2">Throw ingredients in the calculator, set servings, save it.</p>
            </div>
            <ArrowRight className="size-5 transition group-hover:translate-x-1" />
          </Link>
        )}
      </section>
    </>
  );
}

function Hero({ products }: { products: Product[] }) {
  // Show real tags from the pantry when we have a member deal, otherwise illustrative ones.
  const showcase = products.find((p) => p.offers.some((o) => o.memberOnly && o.price != null));
  const regular = showcase ? showcase.price : 24.9;
  const member = showcase ? effectivePrice(showcase, "member").price : 19.9;
  const unit = showcase?.priceBasis === "kg" ? "/kg" : undefined;

  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-shell px-6 py-10 text-shell-ink shadow-lg sm:px-10 sm:py-14">
      <div className="pointer-events-none absolute -right-10 -top-24 size-96 rounded-full bg-tag/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-1/3 size-96 rounded-full bg-member/25 blur-3xl" />
      <div
        className="pointer-events-none absolute -bottom-10 right-4 select-none font-price text-[16rem] font-extrabold leading-none text-white/[0.03]"
        aria-hidden
      >
        kr
      </div>

      <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-shell-muted">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-tag opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-tag" />
            </span>
            Live prices from Willys &amp; ICA
          </div>
          <h1 className="display max-w-2xl text-5xl font-bold leading-[0.92] sm:text-7xl">
            What does dinner{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-tag-ink">actually</span>
              <span className="absolute inset-x-[-0.12em] bottom-[0.06em] top-[0.12em] -rotate-2 rounded-lg bg-tag" aria-hidden />
            </span>{" "}
            cost?
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-shell-ink/75">
            Paste a product link or search by name. foodprice reads the price, the member offer and the nutrition, then
            tells you what every serving costs, and what you get for it.
          </p>
          <div className="mt-8 max-w-2xl">
            <AddProduct variant="hero" />
          </div>
          <p className="mt-3 text-xs text-shell-muted">
            Try “havregryn”, or <span className="font-mono text-shell-ink/80">willys.se/produkt/…</span> ·{" "}
            <Link href="/ica-helper" className="underline underline-offset-2 hover:text-shell-ink">
              ICA being stubborn?
            </Link>
          </p>
        </div>

        <div className="relative hidden h-64 lg:block" aria-hidden>
          {/* the rail the tags hang from */}
          <div className="absolute inset-x-0 top-0 h-2 rounded-full bg-white/15" />
          <div className="animate-swing absolute left-4 top-2" style={{ ["--rot" as string]: "-6deg" }}>
            <div className="mx-auto h-6 w-px bg-white/30" />
            <ShelfTag value={regular} unit={unit} size="md" label="Ordinarie" />
          </div>
          <div className="animate-swing absolute right-0 top-2" style={{ ["--rot" as string]: "5deg", animationDelay: "-2s" }}>
            <div className="mx-auto h-16 w-px bg-white/30" />
            <ShelfTag
              value={member}
              unit={unit}
              size="lg"
              variant="member"
              label={
                <>
                  <Crown className="size-3" /> Member
                </>
              }
            />
          </div>
          <div className="absolute bottom-0 left-8 rounded-2xl bg-white/10 px-4 py-3 text-sm backdrop-blur">
            <div className="text-shell-muted">You save</div>
            <div className="font-price text-3xl font-extrabold text-tag">{formatNumber(((regular - member) / regular) * 100)}%</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProteinChart({ rows }: { rows: { p: Product; per10: number }[] }) {
  const values = rows.map((r) => 100 / r.per10); // grams of protein per 10 kr
  const max = Math.max(...values);
  return (
    <ol className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.p.id}>
          <Link href={`/products/${r.p.id}`} className="group grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3">
            <ProductThumb src={r.p.imageUrl} alt={r.p.name} size={40} className="rounded-xl" />
            <div className="min-w-0">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="truncate text-sm font-medium group-hover:underline">{r.p.name}</span>
                <StoreBadge store={r.p.store} className="!h-4 !px-1.5 !text-[8px]" />
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-bg-2">
                <div
                  className="h-full rounded-full bg-protein transition-all"
                  style={{ width: `${(values[i] / max) * 100}%`, opacity: 1 - i * 0.1 }}
                />
              </div>
            </div>
            <div className="w-24 text-right">
              <div className="font-price text-2xl font-extrabold leading-none">{formatNumber(values[i], 1)} g</div>
              <div className="num whitespace-nowrap text-[10px] text-muted">{formatSek(r.per10, { suffix: false })} kr / 10 g</div>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}
