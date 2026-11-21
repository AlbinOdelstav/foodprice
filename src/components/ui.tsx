import clsx from "clsx";
import { Crown, Tag } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { energySplit, isOfferActive } from "@/lib/domain/calc";
import { formatNumber } from "@/lib/domain/format";
import type { Macros, Offer, StoreId } from "@/lib/domain/types";

/* ------------------------------------------------------------------ */
/* Shelf tag — the signature price display                             */
/* ------------------------------------------------------------------ */

function splitPrice(value: number): { kr: string; ore: string | null } {
  const cents = Math.round(value * 100);
  const kr = Math.floor(cents / 100);
  const ore = cents % 100;
  return { kr: kr.toLocaleString("sv-SE"), ore: ore === 0 ? null : String(ore).padStart(2, "0") };
}

const TAG_SIZES = {
  xs: { kr: "text-xl", ore: "text-[10px] mt-0.5", unit: "text-[9px]", pad: "px-1.5 pt-0.5 pb-0.5 rounded-md", label: "text-[8px]" },
  sm: { kr: "text-3xl", ore: "text-sm mt-0.5", unit: "text-[10px]", pad: "px-2 pt-1 pb-1 rounded-lg", label: "text-[9px]" },
  md: { kr: "text-5xl", ore: "text-xl mt-1", unit: "text-xs", pad: "px-3 pt-1.5 pb-1.5 rounded-xl", label: "text-[10px]" },
  lg: { kr: "text-7xl", ore: "text-3xl mt-1.5", unit: "text-sm", pad: "px-4 pt-2 pb-2 rounded-2xl", label: "text-xs" },
};

/**
 * A Swedish-style shelf label: big condensed kronor, superscript öre, "49:-" for whole kronor.
 * `variant="member"` renders the green member tag.
 */
export function ShelfTag({
  value,
  unit,
  label,
  variant = "regular",
  size = "md",
  was,
  className,
  tilt,
}: {
  value: number | null;
  unit?: string;
  label?: ReactNode;
  variant?: "regular" | "member" | "plain";
  size?: keyof typeof TAG_SIZES;
  was?: number | null;
  className?: string;
  tilt?: number;
}) {
  const s = TAG_SIZES[size];
  const colors = {
    regular: "bg-tag text-tag-ink",
    member: "bg-member text-member-ink",
    plain: "bg-surface text-ink border border-line",
  }[variant];
  const p = value != null && Number.isFinite(value) ? splitPrice(value) : null;

  return (
    <div
      className={clsx("relative inline-flex flex-col font-price shadow-card", colors, s.pad, className)}
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
    >
      {label && (
        <div className={clsx("flex items-center gap-1 font-bold uppercase tracking-[0.14em] opacity-90", s.label)}>{label}</div>
      )}
      <div className="flex items-start leading-[0.85]">
        <span className={clsx("font-extrabold tracking-tight", s.kr)}>{p ? p.kr : "–"}</span>
        {p && <span className={clsx("font-extrabold", s.ore)}>{p.ore ?? ":-"}</span>}
        {unit && <span className={clsx("ml-1 self-end font-semibold opacity-75", s.unit)}>{unit}</span>}
      </div>
      {was != null && (
        <div className={clsx("mt-0.5 font-semibold opacity-75", s.unit)}>
          ord. <span className="line-through">{splitPrice(was).kr}:{splitPrice(was).ore ?? "-"}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

const STORE_STYLE: Record<StoreId, { label: string; className: string }> = {
  willys: { label: "Willys", className: "bg-[#e3141b] text-white" },
  ica: { label: "ICA", className: "bg-[#e3000b] text-white" },
  manual: { label: "Manual", className: "bg-ink text-bg" },
};

export function StoreBadge({ store, className }: { store: StoreId; className?: string }) {
  const s = STORE_STYLE[store];
  return (
    <span className={clsx("inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold uppercase tracking-wider", s.className, className)}>
      {s.label}
    </span>
  );
}

const ALLOWED_IMAGE_HOSTS = ["assets.axfood.se", "handlaprivatkund.ica.se"];

export function ProductThumb({
  src,
  alt,
  size = 56,
  className,
}: {
  src: string | null;
  alt: string;
  size?: number;
  className?: string;
}) {
  let host: string | null = null;
  try {
    host = src ? new URL(src).hostname : null;
  } catch {}
  const ok = src && host && ALLOWED_IMAGE_HOSTS.includes(host);
  return (
    <div
      className={clsx("relative grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-white ring-1 ring-line", !ok && "stripes", className)}
      style={{ width: size, height: size }}
    >
      {ok ? (
        <Image src={src} alt={alt} fill sizes={`${size * 2}px`} className="object-contain p-[8%]" />
      ) : (
        <span className="display text-lg font-bold text-muted" aria-hidden>
          {alt.slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );
}

export function OfferChip({ offer, now }: { offer: Offer; now?: number }) {
  const active = isOfferActive(offer, now);
  return (
    <span
      className={clsx(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold",
        !active && "line-through opacity-50",
        offer.memberOnly ? "bg-member text-member-ink" : "bg-tag text-tag-ink",
      )}
      title={offer.validUntil ? `Valid until ${new Date(offer.validUntil).toLocaleDateString("sv-SE")}` : undefined}
    >
      {offer.memberOnly ? <Crown className="size-3" /> : <Tag className="size-3" />}
      {offer.label}
    </span>
  );
}

export function daysLeft(validUntil: string | null, now = Date.now()): number | null {
  if (!validUntil) return null;
  return Math.max(0, Math.ceil((new Date(validUntil).getTime() - now) / 86_400_000));
}

/* ------------------------------------------------------------------ */
/* Macros                                                              */
/* ------------------------------------------------------------------ */

export const MACRO_META = [
  { key: "protein", label: "Protein", color: "var(--protein)", dot: "bg-protein" },
  { key: "fat", label: "Fat", color: "var(--fat)", dot: "bg-fat" },
  { key: "carbs", label: "Carbs", color: "var(--carbs)", dot: "bg-carbs" },
] as const;

export function MacroBar({ macros, className }: { macros: Macros; className?: string }) {
  const s = energySplit(macros);
  const empty = s.protein + s.fat + s.carbs === 0;
  return (
    <div
      className={clsx("flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full", empty && "bg-bg-2", className)}
      role="img"
      aria-label={`Energy from protein ${Math.round(s.protein * 100)}%, fat ${Math.round(s.fat * 100)}%, carbs ${Math.round(s.carbs * 100)}%`}
    >
      {!empty &&
        MACRO_META.map((m) =>
          s[m.key] > 0 ? <div key={m.key} className={clsx("rounded-full", m.dot)} style={{ width: `${s[m.key] * 100}%` }} /> : null,
        )}
    </div>
  );
}

/** Donut of the energy split with kcal in the middle. */
export function MacroDonut({ macros, size = 140, label = "kcal" }: { macros: Macros; size?: number; label?: string }) {
  const s = energySplit(macros);
  const r = 42;
  const c = 2 * Math.PI * r;
  const gap = 2.5;
  const lengths = MACRO_META.map((m) => s[m.key] * c);
  const segments = MACRO_META.map((m, i) => ({
    ...m,
    len: Math.max(0, lengths[i] - gap),
    offset: lengths.slice(0, i).reduce((a, b) => a + b, 0),
  }));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--bg-2)" strokeWidth="11" />
        {segments.map((seg) =>
          seg.len > 0 ? (
            <circle
              key={seg.key}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={`${seg.len} ${c}`}
              strokeDashoffset={-seg.offset}
            />
          ) : null,
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-price text-3xl font-extrabold leading-none">{formatNumber(macros.kcal)}</div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">{label}</div>
        </div>
      </div>
    </div>
  );
}

export function MacroLegend({ macros, unit = "g", className }: { macros: Macros; unit?: string; className?: string }) {
  const s = energySplit(macros);
  return (
    <ul className={clsx("space-y-2", className)}>
      {MACRO_META.map((m) => (
        <li key={m.key} className="flex items-center gap-3">
          <span className={clsx("size-2.5 rounded-full", m.dot)} />
          <span className="flex-1 text-sm text-ink-2">{m.label}</span>
          <span className="num text-sm font-semibold">
            {formatNumber(macros[m.key], macros[m.key] >= 100 ? 0 : 1)} {unit}
          </span>
          <span className="num w-10 text-right text-xs text-muted">{Math.round(s[m.key] * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}

export function MacroInline({ macros, className }: { macros: Macros | null; className?: string }) {
  if (!macros) return <span className={clsx("text-xs text-muted", className)}>No nutrition data</span>;
  return (
    <span className={clsx("num inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2", className)}>
      <span>
        <b className="font-semibold text-ink">{formatNumber(macros.kcal)}</b> kcal
      </span>
      {MACRO_META.map((m) => (
        <span key={m.key} className="inline-flex items-center gap-1">
          <i className={clsx("size-1.5 rounded-full", m.dot)} />
          {formatNumber(macros[m.key], 1)}g
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export function PageHeader({ eyebrow, title, lede, children }: { eyebrow?: ReactNode; title: ReactNode; lede?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
        <h1 className="display text-5xl font-bold leading-[0.95] sm:text-6xl">{title}</h1>
        {lede && <p className="mt-4 text-[17px] leading-relaxed text-ink-2">{lede}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card stripes flex flex-col items-center gap-4 border-dashed px-6 py-14 text-center">
      <div className="grid size-14 rotate-[-6deg] place-items-center rounded-2xl bg-tag text-tag-ink shadow-card">{icon}</div>
      <h3 className="display text-2xl font-bold">{title}</h3>
      {children && <div className="max-w-md text-sm leading-relaxed text-ink-2">{children}</div>}
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "plain",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "plain" | "tag" | "member" | "dark";
}) {
  const tones = {
    plain: "bg-surface border border-line text-ink",
    tag: "bg-tag text-tag-ink",
    member: "bg-member text-member-ink",
    dark: "bg-shell text-shell-ink",
  };
  return (
    <div className={clsx("relative overflow-hidden rounded-3xl p-5 shadow-card", tones[tone])}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">{label}</span>
        {icon && <span className="opacity-70">{icon}</span>}
      </div>
      <div className="mt-3 font-price text-5xl font-extrabold leading-none tracking-tight">{value}</div>
      {hint && <div className="mt-2 text-xs opacity-75">{hint}</div>}
    </div>
  );
}
