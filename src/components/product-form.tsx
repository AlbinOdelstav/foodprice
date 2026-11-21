"use client";

import { Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { api, errorMessage } from "@/lib/api/client";
import type { BaseUnit, Macros, Offer, PriceBasis, Product } from "@/lib/domain/types";
import { useToast } from "./toast";

interface FormState {
  name: string;
  brand: string;
  price: string;
  memberPrice: string;
  priceBasis: PriceBasis;
  baseUnit: BaseUnit;
  packageSize: string;
  pieces: string;
  pieceSize: string;
  kcal: string;
  protein: string;
  fat: string;
  carbs: string;
}

const str = (n: number | null | undefined) => (n == null ? "" : String(n));
const num = (s: string) => {
  const v = Number(s.replace(",", ".").trim());
  return s.trim() === "" || !Number.isFinite(v) ? null : v;
};

function initial(p?: Product): FormState {
  return {
    name: p?.name ?? "",
    brand: p?.brand ?? "",
    price: str(p?.price),
    memberPrice: str(p?.offers.find((o) => o.memberOnly)?.price),
    priceBasis: p?.priceBasis ?? "package",
    baseUnit: p?.baseUnit ?? "g",
    packageSize: str(p?.packageSize),
    pieces: str(p?.pieces),
    pieceSize: str(p?.pieceSize),
    kcal: str(p?.nutrition?.kcal),
    protein: str(p?.nutrition?.protein),
    fat: str(p?.nutrition?.fat),
    carbs: str(p?.nutrition?.carbs),
  };
}

/** Create a manual product, or edit (override) any product. */
export function ProductForm({ product, onDone }: { product?: Product; onDone?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<FormState>(() => initial(product));
  const [saving, setSaving] = useState(false);
  const isManual = !product || product.store === "manual";
  const locked = new Set(product?.overrides ?? []);
  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const price = num(f.price);
    if (!f.name.trim() || price == null) {
      toast("error", "Name and price are required.");
      return;
    }
    const macroValues = [f.kcal, f.protein, f.fat, f.carbs].map(num);
    const nutrition: Macros | null = macroValues.some((v) => v != null)
      ? { kcal: macroValues[0] ?? 0, protein: macroValues[1] ?? 0, fat: macroValues[2] ?? 0, carbs: macroValues[3] ?? 0 }
      : null;
    const fields = {
      name: f.name.trim(),
      brand: f.brand.trim() || null,
      price,
      priceBasis: f.priceBasis,
      baseUnit: f.baseUnit,
      packageSize: num(f.packageSize),
      pieces: num(f.pieces),
      pieceSize: num(f.pieceSize),
      nutrition,
    };

    setSaving(true);
    try {
      if (!product) {
        const memberPrice = num(f.memberPrice);
        const offers: Offer[] =
          memberPrice != null
            ? [{ label: "Medlemspris", memberOnly: true, price: memberPrice, minQuantity: 1, validUntil: null }]
            : [];
        const created = await api<Product>("/api/products", { body: { ...fields, offers, url: null, imageUrl: null } });
        toast("success", `Added ${created.name}`);
        router.push(`/products/${created.id}`);
      } else {
        // Only send what changed so untouched store values don't become overrides.
        const before = initial(product);
        const patch: Record<string, unknown> = {};
        const changed = (keys: (keyof FormState)[]) => keys.some((k) => f[k] !== before[k]);
        if (changed(["name"])) patch.name = fields.name;
        if (changed(["brand"])) patch.brand = fields.brand;
        if (changed(["price"])) patch.price = fields.price;
        if (changed(["priceBasis"])) patch.priceBasis = fields.priceBasis;
        if (changed(["baseUnit"])) patch.baseUnit = fields.baseUnit;
        if (changed(["packageSize"])) patch.packageSize = fields.packageSize;
        if (changed(["pieces"])) patch.pieces = fields.pieces;
        if (changed(["pieceSize"])) patch.pieceSize = fields.pieceSize;
        if (changed(["kcal", "protein", "fat", "carbs"])) patch.nutrition = fields.nutrition;
        if (Object.keys(patch).length) {
          await api(`/api/products/${product.id}`, { method: "PATCH", body: patch });
          toast("success", "Saved");
        }
        router.refresh();
        onDone?.();
      }
    } catch (err) {
      toast("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const lockIcon = (field: string) =>
    locked.has(field as never) ? <Lock className="ml-1 inline size-3 text-tag" aria-label="Overridden — kept on refresh" /> : null;

  return (
    <form onSubmit={submit} className="space-y-6">
      <Section title="Product">
        <Field label={<>Name {lockIcon("name")}</>} className="sm:col-span-2">
          <input className="input" value={f.name} onChange={set("name")} required maxLength={200} />
        </Field>
        <Field label={<>Brand {lockIcon("brand")}</>}>
          <input className="input" value={f.brand} onChange={set("brand")} maxLength={120} />
        </Field>
      </Section>

      <Section title="Price">
        <Field label={<>Price (kr) {lockIcon("price")}</>}>
          <input className="input num" inputMode="decimal" value={f.price} onChange={set("price")} required />
        </Field>
        <Field label={<>Priced per {lockIcon("priceBasis")}</>}>
          <select className="input" value={f.priceBasis} onChange={set("priceBasis")}>
            <option value="package">Package / item</option>
            <option value="kg">Kilogram</option>
          </select>
        </Field>
        {isManual && !product && (
          <Field label="Member price (optional)">
            <input className="input num" inputMode="decimal" value={f.memberPrice} onChange={set("memberPrice")} />
          </Field>
        )}
      </Section>

      <Section title="Package" hint="Used to turn grams into cost and macros.">
        <Field label={<>Measured in {lockIcon("baseUnit")}</>}>
          <select className="input" value={f.baseUnit} onChange={set("baseUnit")}>
            <option value="g">Grams (solid)</option>
            <option value="ml">Millilitres (liquid)</option>
          </select>
        </Field>
        <Field label={<>Package size ({f.baseUnit}) {lockIcon("packageSize")}</>}>
          <input className="input num" inputMode="decimal" value={f.packageSize} onChange={set("packageSize")} placeholder="e.g. 500" />
        </Field>
        <Field label={<>Pieces per package {lockIcon("pieces")}</>}>
          <input className="input num" inputMode="decimal" value={f.pieces} onChange={set("pieces")} placeholder="e.g. 12 eggs" />
        </Field>
        <Field label={<>Weight of one piece ({f.baseUnit}) {lockIcon("pieceSize")}</>}>
          <input className="input num" inputMode="decimal" value={f.pieceSize} onChange={set("pieceSize")} placeholder="e.g. 120 for a lemon" />
        </Field>
      </Section>

      <Section title={<>Nutrition per 100 {f.baseUnit} {lockIcon("nutrition")}</>}>
        {(["kcal", "protein", "fat", "carbs"] as const).map((k) => (
          <Field key={k} label={k === "kcal" ? "Energy (kcal)" : `${k[0].toUpperCase()}${k.slice(1)} (g)`}>
            <input className="input num" inputMode="decimal" value={f[k]} onChange={set(k)} />
          </Field>
        ))}
      </Section>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {product ? "Save changes" : "Add product"}
        </button>
        {onDone && (
          <button type="button" className="btn-ghost" onClick={onDone}>
            Cancel
          </button>
        )}
        {!isManual && (
          <p className="text-xs text-muted">
            Edited fields get a <Lock className="inline size-3 text-tag" /> and are kept when prices are refreshed.
          </p>
        )}
      </div>
    </form>
  );
}

function Section({ title, hint, children }: { title: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="display mb-3 text-xl font-bold">
        {title}
        {hint && <span className="ml-2 font-sans text-xs text-muted">{hint}</span>}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </fieldset>
  );
}

function Field({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
