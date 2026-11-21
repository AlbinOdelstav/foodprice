"use client";

import clsx from "clsx";
import { Bookmark, Calculator, ChefHat, Crown, LayoutGrid, ShoppingBasket } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";

const LINKS = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/products", label: "Pantry", icon: ShoppingBasket },
  { href: "/calculator", label: "Calculator", icon: Calculator },
  { href: "/recipes", label: "Recipes", icon: ChefHat },
];

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-hidden bg-shell text-shell-ink lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-tag/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-member/20 blur-3xl" />

        <Link href="/" className="relative flex items-center gap-3 px-6 pb-8 pt-7" aria-label="foodprice home">
          <Logo className="size-10" />
          <div>
            <div className="display text-[22px] font-bold leading-none">foodprice</div>
            <div className="mt-1 text-[11px] text-shell-muted">what food really costs</div>
          </div>
        </Link>

        <nav className="relative flex-1 px-3" aria-label="Main">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-shell-muted">Menu</div>
          <ul className="space-y-1">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-medium transition",
                      active ? "bg-tag text-tag-ink shadow-lg" : "text-shell-ink/80 hover:bg-shell-2 hover:text-shell-ink",
                    )}
                  >
                    <Icon className={clsx("size-[18px]", !active && "text-shell-muted group-hover:text-shell-ink")} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="relative space-y-3 p-4">
          <Link
            href="/ica-helper"
            className={clsx(
              "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition",
              pathname.startsWith("/ica-helper") ? "bg-shell-2 text-shell-ink" : "text-shell-muted hover:bg-shell-2 hover:text-shell-ink",
            )}
          >
            <Bookmark className="size-4" /> ICA browser helper
          </Link>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span className="grid size-6 place-items-center rounded-full bg-member text-member-ink">
                <Crown className="size-3.5" />
              </span>
              Member prices
            </div>
            <p className="text-xs leading-relaxed text-shell-muted">
              Every price is shown twice: what anyone pays, and what you pay with <span className="text-shell-ink">Willys Plus</span> or{" "}
              <span className="text-shell-ink">ICA Stammis</span>.
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-shell px-4 text-shell-ink lg:hidden">
        <Link href="/" className="flex items-center gap-2" aria-label="foodprice home">
          <Logo className="size-7" />
          <span className="display text-lg font-bold">foodprice</span>
        </Link>
      </header>

      {/* Mobile tab bar */}
      <nav
        className="fixed inset-x-3 bottom-3 z-30 rounded-3xl bg-shell/95 p-1.5 shadow-lg backdrop-blur lg:hidden"
        aria-label="Main"
      >
        <ul className="grid grid-cols-4">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-medium transition",
                    active ? "bg-tag text-tag-ink" : "text-shell-muted",
                  )}
                >
                  <Icon className="size-5" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
