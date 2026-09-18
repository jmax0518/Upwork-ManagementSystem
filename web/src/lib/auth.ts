import { NextRequest } from "next/server";

export function assertApiAuthorized(request: NextRequest): Response | null {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;

  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== apiKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
