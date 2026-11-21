import { z } from "zod";
import { handle, readJson } from "@/lib/api/server";
import { ingestIcaPayload } from "@/lib/services/products";

const schema = z.object({ url: z.string().url().max(2000), payload: z.record(z.string(), z.unknown()) });

/** Receives product JSON captured in the user's browser by the ICA bookmarklet. */
export const POST = handle(async (request: Request) => {
  const { url, payload } = await readJson(request, schema);
  const { product, created } = ingestIcaPayload(payload, url);
  return Response.json({ product, created }, { status: created ? 201 : 200 });
});
