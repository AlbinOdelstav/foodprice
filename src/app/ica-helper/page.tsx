import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { BookmarkletLink } from "@/components/bookmarklet";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "ICA helper" };

const STEPS = [
  { title: "Drag the button to your bookmarks bar", body: "Show the bar with Ctrl+Shift+B if it's hidden." },
  { title: "Open any product on handlaprivatkund.ica.se", body: "Pick your store as usual — prices follow the store in the link." },
  { title: "Click “+ foodprice” in the bar", body: "A small foodprice window opens and the product lands in your pantry." },
];

export default function IcaHelperPage() {
  return (
    <>
      <PageHeader eyebrow="Import" title="ICA helper" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="card p-6 sm:p-8">
          <p className="max-w-2xl text-ink-2">
            ICA protects its online store against automated traffic. foodprice can usually read a pasted ICA link, but
            when ICA says “slow down”, this bookmark reads the product <em>in your own browser</em> — where you&apos;re
            already a normal visitor — and hands it over.
          </p>
          <div className="my-8 flex justify-center rounded-2xl border border-dashed border-line-strong bg-surface-2 py-10">
            <BookmarkletLink />
          </div>
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-line p-4">
                <div className="num mb-2 grid size-7 place-items-center rounded-full bg-ink text-sm text-bg">{i + 1}</div>
                <div className="font-medium">{s.title}</div>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
        <aside className="card h-fit p-5 text-sm text-ink-2">
          <h2 className="mb-2 flex items-center gap-2 font-medium text-ink">
            <ShieldCheck className="size-4 text-member" /> What it does
          </h2>
          <p>
            It only runs when you click it, only on ICA product pages, and only reads that one product&apos;s public
            details (name, price, offers, nutrition). Nothing about your ICA account is sent anywhere. The data goes
            straight to this foodprice instance on your computer.
          </p>
        </aside>
      </div>
    </>
  );
}
