import { handle, importSchema, readJson } from "@/lib/api/server";
import { importFromUrl } from "@/lib/services/products";

export const POST = handle(async (request: Request) => {
  const { url } = await readJson(request, importSchema);
  const { product, created } = await importFromUrl(url);
  return Response.json({ product, created }, { status: created ? 201 : 200 });
});
