import { assertApiAuthorized } from "@/lib/auth";
import { normalizeUpworkJobId, updateJobStatus } from "@/lib/jobs";
import type { PipelineStatus } from "@/types/job";
import { NextRequest } from "next/server";

type RouteContext = {
  params: Promise<{ upworkJobId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const denied = assertApiAuthorized(request);
  if (denied) return denied;

  const { upworkJobId: rawId } = await context.params;
  const upworkJobId = normalizeUpworkJobId(rawId);

  let body: { pipelineStatus?: PipelineStatus; notes?: string };
  try {
    body = (await request.json()) as { pipelineStatus?: PipelineStatus; notes?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.pipelineStatus) {
    return Response.json({ error: "pipelineStatus is required" }, { status: 400 });
  }

  const job = await updateJobStatus(upworkJobId, body.pipelineStatus, body.notes);
  if (!job) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  return Response.json({ ok: true, job });
}
