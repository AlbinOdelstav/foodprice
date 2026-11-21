"use client";

import clsx from "clsx";
import { AlertTriangle, Crown, Loader2, Minus, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api/client";
import { calcLine, calcTotals, scaleMacros, type LineResult } from "@/lib/domain/calc";
import { formatAmount, formatNumber, formatSek, UNIT_LABELS } from "@/lib/domain/format";
import { LINE_UNITS, type LineUnit, type Product, type Recipe } from "@/lib/domain/types";
import type { RefreshResult } from "@/lib/services/products";
import { AddProduct } from "./add-product";
import { useToast } from "./toast";
import { MacroBar, MacroInline, MACRO_META, OfferChip, ProductThumb, ShelfTag, StoreBadge } from "./ui";

interface Line {
  key: string;
  productId: number;
  quantity: number;
  unit: LineUnit;
}

interface Draft {
  name: string;
  servings: number;
  lines: Line[];
}

const DRAFT_KEY = "foodprice:calculator";
const newKey = () => Math.random().toString(36).slice(2, 10);

function defaultLine(p: Product): Line {
  return p.priceBasis === "kg"
    ? { key: newKey(), productId: p.id, quantity: 100, unit: "g" }
    : { key: newKey(), productId: p.id, quantity: 1, unit: "pkg" };
}

export function RecipeEditor({ products: initialProducts, recipe }: { products: Product[]; recipe?: Recipe }) {
  const router = useRouter();
  const toast = useToast();
  const scratch = !recipe;

  // Products added or refreshed in this session, merged over the server's list (newest wins).
  const [local, setLocal] = useState<Product[]>([]);
  const products = useMemo(() => {
    const map = new Map(initialProducts.map((p) => [p.id, p]));
    for (const p of local) {
      const server = map.get(p.id);
      if (!server || server.updatedAt <= p.updatedAt) map.set(p.id, p);
    }
    return Array.from(map.values());
  }, [initialProducts, local]);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const remember = (fresh: Product[]) =>
    setLocal((ls) => [...ls.filter((l) => !fresh.some((f) => f.id === l.id)), ...fresh]);

  const [draft, setDraft] = useState<Draft>(() => ({
    name: recipe?.name ?? "",
    servings: recipe?.servings ?? 1,
    lines: recipe?.items.map((i) => ({ key: newKey(), productId: i.productId, quantity: i.quantity, unit: i.unit })) ?? [],
  }));
  const [notes, setNotes] = useState(recipe?.notes ?? "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "refresh" | "delete" | null>(null);
  const loaded = useRef(!scratch);

  // The scratch calculator keeps its state in localStorage so it survives reloads.
  useEffect(() => {
    if (!scratch) return;
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as Draft | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore after hydration
      if (saved?.lines) setDraft({ ...saved, lines: saved.lines.filter((l) => byId.has(l.productId)) });
    } catch {}
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scratch]);
  useEffect(() => {
    if (!scratch || !loaded.current) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [draft, scratch]);

  const update = (fn: (d: Draft) => Draft) => {
    setDraft(fn);
    setDirty(true);
  };
  const setLine = (key: string, patch: Partial<Line>) =>
    update((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  const removeLine = (key: string) => update((d) => ({ ...d, lines: d.lines.filter((l) => l.key !== key) }));
  const addProduct = (p: Product) => {
    remember([p]);
    update((d) => ({ ...d, lines: [...d.lines, defaultLine(p)] }));
  };

  const rows = draft.lines
    .map((line) => {
      const product = byId.get(line.productId);
      return product ? { line, product, result: calcLine(product, line) } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r != null);
  const totals = calcTotals(rows.map((r) => r.result));
  const servings = draft.servings > 0 ? draft.servings : 1;

  async function save() {
    const name = draft.name.trim() || (scratch ? "Untitled recipe" : "");
    if (!name) {
      toast("error", "Give the recipe a name.");
      return;
    }
    setBusy("save");
    const body = {
      name,
      servings,
      notes: notes.trim() || null,
      items: draft.lines.map(({ productId, quantity, unit }) => ({ productId, quantity, unit })),
    };
    try {
      if (recipe) {
        await api(`/api/recipes/${recipe.id}`, { method: "PUT", body });
        toast("success", "Recipe saved");
        setDirty(false);
        router.refresh();
      } else {
        const created = await api<Recipe>("/api/recipes", { body });
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {}
        toast("success", `Saved “${created.name}”`);
        router.push(`/recipes/${created.id}`);
      }
    } catch (err) {
      toast("error", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function refreshPrices() {
    const ids = Array.from(new Set(draft.lines.map((l) => l.productId)));
    if (!ids.length) return;
    setBusy("refresh");
    try {
      const results = await api<RefreshResult[]>("/api/products/refresh", { body: { ids } });
      remember(results.flatMap((r) => (r.ok ? [r.product] : [])));
      const failed = results.filter((r) => !r.ok);
      if (failed.length) toast("error", `${failed.length} of ${results.length} couldn't be refreshed: ${(failed[0] as { error: string }).error}`);
      else toast("success", `Refreshed ${results.length} price${results.length > 1 ? "s" : ""}`);
      router.refresh();
    } catch (err) {
      toast("error", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!recipe || !confirm(`Delete “${recipe.name}”?`)) return;
    setBusy("delete");
    try {
      await api(`/api/recipes/${recipe.id}`, { method: "DELETE" });
      toast("success", "Recipe deleted");
      router.push("/recipes");
      router.refresh();
    } catch (err) {
      toast("error", errorMessage(err));
      setBusy(null);
    }
  }

  function clearScratch() {
    if (draft.lines.length && !confirm("Clear the calculator?")) return;
    setDraft({ name: "", servings: 1, lines: [] });
    setDirty(false);
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-5">
        {/* Title + servings */}
        <div className="flex flex-wrap items-end gap-4">
          <label className="min-w-56 flex-1">
            <span className="eyebrow mb-2 block">{scratch ? "Name it (optional)" : "Recipe"}</span>
            <input
              className="display w-full border-b-2 border-dashed border-line-strong bg-transparent pb-1 text-4xl font-bold outline-none placeholder:text-line-strong focus:border-ink sm:text-5xl"
              value={draft.name}
              onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
              placeholder={scratch ? "Tuesday pasta" : "Recipe name"}
              maxLength={200}
            />
          </label>
          <div>
            <span className="eyebrow mb-2 block">Portions</span>
            <div className="flex h-12 items-center rounded-2xl bg-ink text-bg shadow-card">
              <button
                className="grid size-12 place-items-center opacity-70 hover:opacity-100 disabled:opacity-20"
                onClick={() => update((d) => ({ ...d, servings: Math.max(1, d.servings - 1) }))}
                disabled={draft.servings <= 1}
                aria-label="Fewer portions"
              >
                <Minus className="size-4" />
              </button>
              <input
                className="w-10 bg-transparent text-center font-price text-3xl font-extrabold outline-none"
                inputMode="decimal"
                value={draft.servings}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(",", "."));
                  if (Number.isFinite(v) && v >= 0 && v <= 1000) update((d) => ({ ...d, servings: v }));
                }}
                aria-label="Portions"
              />
              <button
                className="grid size-12 place-items-center opacity-70 hover:opacity-100"
                onClick={() => update((d) => ({ ...d, servings: d.servings + 1 }))}
                aria-label="More portions"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <section className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="display text-xl font-bold">Ingredients</h2>
            <span className="rounded-full bg-bg-2 px-2.5 py-0.5 text-xs font-semibold text-ink-2">{rows.length}</span>
          </header>
          {rows.length === 0 ? (
            <div className="stripes px-6 py-12 text-center">
              <p className="display text-xl font-bold">An empty basket</p>
              <p className="mt-1 text-sm text-muted">Add something from your pantry or straight from a store below.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map(({ line, product, result }) => (
                <LineRow
                  key={line.key}
                  line={line}
                  product={product}
                  result={result}
                  onChange={(patch) => setLine(line.key, patch)}
                  onRemove={() => removeLine(line.key)}
                />
              ))}
            </ul>
          )}
          <div className="border-t border-line bg-surface-2 p-5">
            <AddLine products={products} onPick={addProduct} />
          </div>
        </section>

        {!scratch && (
          <label className="block">
            <span className="eyebrow mb-2 block">Notes</span>
            <textarea
              className="input h-auto min-h-28 rounded-2xl py-3"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
              }}
              placeholder="Method, source, tweaks…"
              maxLength={5000}
            />
          </label>
        )}
      </div>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <Receipt
          title={draft.name.trim() || (scratch ? "Calculator" : "Recipe")}
          rows={rows}
          totals={totals}
          servings={servings}
        />
        <div className="mt-5 flex gap-2">
          <button className="btn-primary h-12 flex-1 text-[15px]" onClick={save} disabled={busy != null || (!scratch && !dirty) || rows.length === 0}>
            {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {scratch ? "Save as recipe" : dirty ? "Save changes" : "All saved"}
          </button>
          <button
            className="btn-ghost h-12 w-12 !px-0"
            onClick={refreshPrices}
            disabled={busy != null || rows.length === 0}
            title="Fetch current prices and offers"
            aria-label="Refresh prices"
          >
            {busy === "refresh" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          </button>
          {scratch ? (
            <button className="btn-ghost h-12 w-12 !px-0" onClick={clearScratch} disabled={rows.length === 0} aria-label="Clear calculator" title="Clear">
              <X className="size-4" />
            </button>
          ) : (
            <button className="btn-danger h-12 w-12 !px-0" onClick={remove} disabled={busy != null} aria-label="Delete recipe" title="Delete recipe">
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function LineRow({
  line,
  product: p,
  result: r,
  onChange,
  onRemove,
}: {
  line: Line;
  product: Product;
  result: LineResult;
  onChange: (patch: Partial<Line>) => void;
  onRemove: () => void;
}) {
  const [qty, setQty] = useState(String(line.quantity));
  const memberCheaper =
    r.cost.member.used != null && r.cost.regular.used != null && r.cost.member.used < r.cost.regular.used - 0.005;

  return (
    <li className="group flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 transition hover:bg-surface-2">
      <ProductThumb src={p.imageUrl} alt={p.name} size={60} />
      <div className="min-w-0 flex-1 basis-48">
        <div className="flex items-center gap-2">
          <StoreBadge store={p.store} className="!h-4 !px-1.5 !text-[8px]" />
          <Link href={`/products/${p.id}`} className="truncate font-semibold hover:underline">
            {p.name}
          </Link>
        </div>
        <div className="mt-1 text-xs text-muted">
          {r.amount != null ? <span className="num">{formatAmount(r.amount, p.baseUnit)}</span> : "amount unknown"}
          {r.packagesToBuy != null && (
            <span>
              {" "}
              · buy {r.packagesToBuy} {p.priceBasis === "kg" ? "piece" : "pkg"}
              {r.packages != null && r.packages < 0.995 && ` (use ${Math.round(r.packages * 100)}%)`}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <MacroInline macros={r.macros} />
          {r.cost.member.offer && <OfferChip offer={r.cost.member.offer} />}
          {r.warnings.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-accent" title={r.warnings.join("\n")}>
              <AlertTriangle className="size-3.5" />
              <span className="sr-only">{r.warnings.join(" ")}</span>
              <span aria-hidden>check</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
        <input
          className="num h-8 w-16 rounded-lg bg-bg-2/60 text-right text-sm font-semibold outline-none focus:ring-2 focus:ring-tag"
          inputMode="decimal"
          value={qty}
          onChange={(e) => {
            setQty(e.target.value);
            const v = Number(e.target.value.replace(",", "."));
            if (Number.isFinite(v) && v > 0) onChange({ quantity: v });
          }}
          aria-label={`Quantity of ${p.name}`}
        />
        <select
          className="h-8 rounded-lg bg-transparent px-1 text-sm font-semibold outline-none"
          value={line.unit}
          onChange={(e) => onChange({ unit: e.target.value as LineUnit })}
          aria-label={`Unit for ${p.name}`}
        >
          {LINE_UNITS.map((u) => (
            <option key={u} value={u}>
              {UNIT_LABELS[u]}
            </option>
          ))}
        </select>
      </div>

      <div className="w-24 text-right">
        <div className={clsx("font-price text-2xl font-extrabold leading-none", memberCheaper && "text-muted line-through decoration-2")}>
          {formatSek(r.cost.regular.used, { suffix: false })}
        </div>
        {memberCheaper && (
          <div className="mt-1 inline-flex items-center gap-1 font-price text-xl font-extrabold leading-none text-member">
            <Crown className="size-3.5" />
            {formatSek(r.cost.member.used, { suffix: false })}
          </div>
        )}
      </div>

      <button
        onClick={onRemove}
        className="grid size-8 place-items-center rounded-full text-muted opacity-60 transition hover:bg-accent-soft hover:text-accent group-hover:opacity-100"
        aria-label={`Remove ${p.name}`}
      >
        <X className="size-4" />
      </button>
    </li>
  );
}

function AddLine({ products, onPick }: { products: Product[]; onPick: (p: Product) => void }) {
  const [mode, setMode] = useState<"pantry" | "store">(products.length ? "pantry" : "store");
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => !s || `${p.name} ${p.brand ?? ""}`.toLowerCase().includes(s)).slice(0, 9);
  }, [q, products]);

  return (
    <div>
      <div className="mb-4 inline-flex rounded-full border border-line bg-surface p-1 text-sm" role="tablist">
        {(["pantry", "store"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={clsx("h-8 rounded-full px-4 font-semibold transition", mode === m ? "bg-ink text-bg" : "text-muted hover:text-ink")}
          >
            {m === "pantry" ? "From pantry" : "From a store"}
          </button>
        ))}
      </div>
      {mode === "store" ? (
        <AddProduct onAdded={onPick} />
      ) : (
        <div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input className="input h-12 rounded-2xl pl-11" placeholder="Search your pantry…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search pantry" />
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => onPick(p)}
                  className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm font-medium shadow-sm transition hover:-translate-y-px hover:border-ink"
                >
                  <ProductThumb src={p.imageUrl} alt="" size={28} className="!rounded-full" />
                  <span className="max-w-48 truncate">{p.name}</span>
                  <Plus className="size-3.5 text-muted" />
                </button>
              </li>
            ))}
            {!matches.length && <li className="px-2 py-2 text-sm text-muted">No matches. Try “From a store”.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Totals styled as a till receipt. */
function Receipt({
  title,
  rows,
  totals,
  servings,
}: {
  title: string;
  rows: { product: Product; result: LineResult; line: Line }[];
  totals: ReturnType<typeof calcTotals>;
  servings: number;
}) {
  const { regular, member } = totals.cost;
  const savings = regular.used - member.used;
  const perServing = scaleMacros(totals.macros, 1 / servings);
  const memberPortion = member.used / servings;
  const regularPortion = regular.used / servings;
  const memberDeal = savings > 0.005;
  const now = useMemo(() => new Date().toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }), []);

  return (
    <div className="receipt relative px-6 pb-8 pt-8 font-mono text-[12.5px] leading-relaxed text-ink shadow-lg">
      <div className="text-center">
        <div className="display text-2xl font-bold not-italic tracking-tight">foodprice</div>
        <div className="text-[11px] uppercase tracking-[0.3em] text-muted">kvitto · receipt</div>
        <div className="mt-3 line-clamp-2 font-sans text-base font-semibold">{title}</div>
        <div className="text-[11px] text-muted" suppressHydrationWarning>
          {now} · {formatNumber(servings, 1)} portion{servings === 1 ? "" : "er"}
        </div>
      </div>

      <Rule />

      {rows.length === 0 ? (
        <p className="py-4 text-center text-muted">*** no items ***</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map(({ product, result, line }) => (
            <li key={line.key}>
              <Leader left={<span className="uppercase">{product.name}</span>} right={formatSek(result.cost.regular.used, { suffix: false })} />
              <div className="flex justify-between pl-3 text-[11px] text-muted">
                <span>
                  {formatNumber(line.quantity, 1)} {UNIT_LABELS[line.unit]}
                </span>
                {result.cost.member.used != null &&
                  result.cost.regular.used != null &&
                  result.cost.member.used < result.cost.regular.used - 0.005 && (
                    <span className="text-member">medlem −{formatSek(result.cost.regular.used - result.cost.member.used, { suffix: false })}</span>
                  )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Rule />

      <div className="space-y-1">
        <Leader left="INGREDIENTS USED" right={formatSek(regular.used, { suffix: false })} />
        {memberDeal && <Leader left={<span className="text-member">WITH MEMBERSHIP</span>} right={<span className="text-member">{formatSek(member.used, { suffix: false })}</span>} />}
        <Leader
          left={<span title="Whole packages you'd actually pay for at the till">SHOPPING BILL</span>}
          right={formatSek(memberDeal ? member.shopping : regular.shopping, { suffix: false })}
          muted
        />
      </div>

      <Rule double />

      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted">per portion</div>
          {memberDeal && <div className="mt-1 text-[11px] text-muted line-through">{formatSek(regularPortion)}</div>}
        </div>
        <ShelfTag
          value={rows.length === 0 ? null : memberDeal ? memberPortion : regularPortion}
          variant={memberDeal ? "member" : "regular"}
          size="md"
          tilt={-2}
          label={memberDeal ? <><Crown className="size-3" /> Member</> : undefined}
        />
      </div>

      {memberDeal && (
        <div className="mt-4 rounded-xl bg-member-soft px-3 py-2 text-center font-sans text-sm text-member">
          Membership saves <b className="num">{formatSek(savings)}</b> ({Math.round((savings / regular.used) * 100)}%)
        </div>
      )}

      <Rule />

      <div className="text-[11px] uppercase tracking-[0.2em] text-muted">nutrition per portion</div>
      <div className="mt-2 grid grid-cols-4 gap-1 text-center">
        <div>
          <div className="font-price text-2xl font-extrabold">{formatNumber(perServing.kcal)}</div>
          <div className="text-[10px] text-muted">kcal</div>
        </div>
        {MACRO_META.map((m) => (
          <div key={m.key}>
            <div className="font-price text-2xl font-extrabold" style={{ color: m.color }}>
              {formatNumber(perServing[m.key], 0)}g
            </div>
            <div className="text-[10px] text-muted">{m.label.toLowerCase()}</div>
          </div>
        ))}
      </div>
      <MacroBar macros={perServing} className="mt-3" />

      {(totals.missingCost > 0 || totals.missingMacros > 0) && (
        <p className="mt-4 flex items-start gap-2 font-sans text-xs text-accent">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {[
              totals.missingCost && `${totals.missingCost} item${totals.missingCost > 1 ? "s" : ""} without a cost`,
              totals.missingMacros && `${totals.missingMacros} without nutrition`,
            ]
              .filter(Boolean)
              .join(", ")}
            . Totals are incomplete.
          </span>
        </p>
      )}

      <Barcode />
      <div className="mt-1 text-center text-[10px] uppercase tracking-[0.3em] text-muted">tack för besöket</div>
    </div>
  );
}

function Rule({ double }: { double?: boolean }) {
  return <div className={clsx("my-4 border-line-strong", double ? "border-y-2 border-double py-px" : "border-t border-dashed")} />;
}

function Leader({ left, right, muted }: { left: React.ReactNode; right: React.ReactNode; muted?: boolean }) {
  return (
    <div className={clsx("flex items-baseline gap-2", muted && "text-muted")}>
      <span className="min-w-0 truncate">{left}</span>
      <span className="flex-1 translate-y-[-3px] border-b border-dotted border-line-strong" />
      <span className="num shrink-0 font-semibold">{right}</span>
    </div>
  );
}

const BARS = [3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 1, 2, 1, 2, 3, 1, 1, 2];
function Barcode() {
  return (
    <div className="mx-auto mt-6 flex h-10 w-fit items-stretch gap-[2px] opacity-80" aria-hidden>
      {BARS.map((w, i) => (
        <span key={i} className="bg-ink" style={{ width: w }} />
      ))}
    </div>
  );
}
