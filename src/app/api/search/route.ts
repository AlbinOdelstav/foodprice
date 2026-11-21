import type { NextRequest } from "next/server";
import { BadRequest, handle } from "@/lib/api/server";
import { searchWillys } from "@/lib/stores/willys";

export const GET = handle(async (request: NextRequest) => {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 100) throw new BadRequest("Search for at least two characters.");
  return Response.json(await searchWillys(q));
});
