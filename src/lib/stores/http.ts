const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export type StoreErrorCode = "unsupported-url" | "not-found" | "blocked" | "upstream" | "parse";

export class StoreError extends Error {
  constructor(
    public readonly code: StoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StoreError";
  }
}

export async function fetchJson<T>(
  url: string,
  opts: { timeoutMs?: number; storeName: string } = { storeName: "store" },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", "Accept-Language": "sv-SE,sv;q=0.9" },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 12_000),
      cache: "no-store",
    });
  } catch (err) {
    throw new StoreError("upstream", `Could not reach ${opts.storeName}: ${(err as Error).message}`);
  }
  if (res.status === 404) throw new StoreError("not-found", `${opts.storeName} has no product at that address.`);
  // ICA's bot protection (AWS WAF) answers 202 with an empty body when it wants a browser challenge.
  if (res.status === 202 || res.status === 403 || res.status === 429) {
    throw new StoreError(
      "blocked",
      `${opts.storeName} temporarily blocked automated requests. Wait a minute and try again, or enter the product manually.`,
    );
  }
  if (!res.ok) throw new StoreError("upstream", `${opts.storeName} responded with HTTP ${res.status}.`);
  const text = await res.text();
  if (!text.trim()) throw new StoreError("blocked", `${opts.storeName} returned an empty response. Try again in a minute.`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new StoreError("parse", `${opts.storeName} returned something that wasn't JSON.`);
  }
}
