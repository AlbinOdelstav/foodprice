import { handle, manualProductSchema, readJson } from "@/lib/api/server";
import { createManualProduct, listProducts } from "@/lib/repo/products";

export const GET = handle(async () => Response.json(listProducts()));

export const POST = handle(async (request: Request) => {
  const input = await readJson(request, manualProductSchema);
  return Response.json(createManualProduct(input), { status: 201 });
});
