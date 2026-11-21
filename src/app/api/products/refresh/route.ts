import { handle, idsSchema, readJson } from "@/lib/api/server";
import { refreshProducts } from "@/lib/services/products";

export const POST = handle(async (request: Request) => {
  const { ids } = await readJson(request, idsSchema);
  return Response.json(await refreshProducts(ids));
});
