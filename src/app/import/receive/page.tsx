"use client";

import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProductThumb } from "@/components/ui";
import { api, errorMessage } from "@/lib/api/client";
import { formatSek } from "@/lib/domain/format";
import type { Product } from "@/lib/domain/types";

const ICA_ORIGIN = "https://handlaprivatkund.ica.se";

type State =
  | { kind: "waiting" }
  | { kind: "saving" }
  | { kind: "done"; product: Product; created: boolean }
  | { kind: "error"; message: string };

/** Popup opened by the ICA bookmarklet; receives the product via postMessage. */
export default function ReceivePage() {
  const [state, setState] = useState<State>({ kind: "waiting" });
  const handled = useRef(false);

  useEffect(() => {
    async function onMessage(e: MessageEvent) {
      if (e.origin !== ICA_ORIGIN || handled.current) return;
      const data = e.data as { type?: string; url?: string; payload?: unknown; message?: string };
      if (data?.type === "foodprice:error") {
        handled.current = true;
        setState({ kind: "error", message: `ICA didn't hand over the product: ${data.message ?? "unknown error"}` });
        return;
      }
      if (data?.type !== "foodprice:ica" || typeof data.url !== "string") return;
      handled.current = true;
      setState({ kind: "saving" });
      try {
        const res = await api<{ product: Product; created: boolean }>("/api/products/ingest", {
          body: { url: data.url, payload: data.payload },
        });
        setState({ kind: "done", ...res });
      } catch (err) {
        setState({ kind: "error", message: errorMessage(err) });
      }
    }
    window.addEventListener("message", onMessage);

    // Tell the ICA tab we're listening. Retry briefly in case it isn't ready yet.
    const ping = () => window.opener?.postMessage("foodprice:ready", ICA_ORIGIN);
    ping();
    let tries = 0;
    const timer = setInterval(() => {
      if (handled.current || ++tries > 20) {
        clearInterval(timer);
        if (!handled.current) setState({ kind: "error", message: "Nothing arrived. Open this from the “+ foodprice” bookmark on an ICA product page." });
        return;
      }
      ping();
    }, 500);
    return () => {
      window.removeEventListener("message", onMessage);
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="card animate-rise p-6 text-center">
        {(state.kind === "waiting" || state.kind === "saving") && (
          <>
            <Loader2 className="mx-auto size-8 animate-spin text-muted" />
            <p className="mt-3 text-ink-2">{state.kind === "waiting" ? "Waiting for ICA…" : "Adding to your pantry…"}</p>
          </>
        )}
        {state.kind === "error" && (
          <>
            <CircleAlert className="mx-auto size-8 text-accent" />
            <p className="mt-3 text-ink-2" role="alert">
              {state.message}
            </p>
          </>
        )}
        {state.kind === "done" && (
          <>
            <CheckCircle2 className="mx-auto size-8 text-member" />
            <h1 className="mt-2 font-display text-2xl">{state.created ? "Added" : "Updated"}</h1>
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-line p-3 text-left">
              <ProductThumb src={state.product.imageUrl} alt={state.product.name} size={56} />
              <div className="min-w-0">
                <div className="truncate font-medium">{state.product.name}</div>
                <div className="num text-sm text-ink-2">{formatSek(state.product.price)}</div>
              </div>
            </div>
            <div className="mt-5 flex justify-center gap-2">
              <Link href={`/products/${state.product.id}`} className="btn-primary">
                Open product
              </Link>
              <button className="btn-ghost" onClick={() => window.close()}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
