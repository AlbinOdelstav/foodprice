import { Crown, Users } from "lucide-react";
import Link from "next/link";
import { formatNumber } from "@/lib/domain/format";
import type { RecipeSummary } from "@/lib/domain/summary";
import { MacroBar, MACRO_META, ProductThumb, ShelfTag } from "./ui";

export function RecipeCard({ summary: { recipe, perServing, totals, images } }: { summary: RecipeSummary }) {
  const memberDeal = perServing.member < perServing.regular - 0.005;
  const s = recipe.servings > 0 ? recipe.servings : 1;
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative h-36 overflow-hidden bg-shell">
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-tag/20 blur-2xl" />
        <div className="absolute inset-0 flex items-center gap-2 px-5">
          {images.slice(0, 4).map((src, i) => (
            <ProductThumb
              key={i}
              src={src}
              alt=""
              size={64}
              className="shadow-card transition duration-300 group-hover:-translate-y-1"
            />
          ))}
          {images.length > 4 && (
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-white/10 text-sm font-semibold text-shell-ink">
              +{images.length - 4}
            </div>
          )}
        </div>
        <div className="absolute -bottom-0 right-4 translate-y-1/3">
          <ShelfTag
            value={memberDeal ? perServing.member : perServing.regular}
            variant={memberDeal ? "member" : "regular"}
            size="sm"
            tilt={-3}
            label={memberDeal ? <><Crown className="size-2.5" /> per portion</> : "per portion"}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 pt-6">
        <h3 className="display line-clamp-2 pr-24 text-xl font-bold leading-tight">{recipe.name}</h3>
        <p className="mt-1.5 flex items-center gap-2 text-xs text-muted">
          <span>{recipe.items.length} ingredients</span>·
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" /> {formatNumber(recipe.servings, 1)}
          </span>
        </p>
        <div className="mt-auto pt-5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-price text-2xl font-extrabold">
              {formatNumber(perServing.kcal)}
              <span className="ml-1 font-sans text-xs font-medium text-muted">kcal / portion</span>
            </span>
            <span className="num flex gap-2 text-xs text-ink-2">
              {MACRO_META.map((m) => (
                <span key={m.key} className="inline-flex items-center gap-1">
                  <i className={`size-1.5 rounded-full ${m.dot}`} />
                  {formatNumber(totals.macros[m.key] / s, 0)}g
                </span>
              ))}
            </span>
          </div>
          <MacroBar macros={totals.macros} />
        </div>
      </div>
    </Link>
  );
}
