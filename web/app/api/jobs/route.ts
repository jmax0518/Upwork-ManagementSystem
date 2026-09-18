import { assertApiAuthorized } from "@/lib/auth";
import { readJobs, upsertJobFromExtension } from "@/lib/jobs";
import type { ExtensionJobPayload } from "@/types/job";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const denied = assertApiAuthorized(request);
  if (denied) return denied;

  const jobs = await readJobs();
  return Response.json({ jobs });
}

export async function POST(request: NextRequest) {
  const denied = assertApiAuthorized(request);
  if (denied) return denied;

  let payload: ExtensionJobPayload;
  try {
    payload = (await request.json()) as ExtensionJobPayload;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload?.upworkJobId) {
    return Response.json({ error: "Missing upworkJobId" }, { status: 400 });
  }

  const { job, created } = await upsertJobFromExtension(payload);
  return Response.json({ ok: true, job }, { status: created ? 201 : 200 });
}
