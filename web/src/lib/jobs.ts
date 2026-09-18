import fs from "node:fs/promises";
import path from "node:path";
import type { ExtensionJobPayload, JobRecord, PipelineStatus } from "@/types/job";

const DATA_DIR = path.join(process.cwd(), "data");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");

export async function readJobs(): Promise<JobRecord[]> {
  try {
    const raw = await fs.readFile(JOBS_FILE, "utf8");
    const parsed = JSON.parse(raw) as JobRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeJobs(jobs: JobRecord[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(JOBS_FILE, JSON.stringify(jobs, null, 2), "utf8");
}

export async function upsertJobFromExtension(
  payload: ExtensionJobPayload
): Promise<{ job: JobRecord; created: boolean }> {
  const jobs = await readJobs();
  const now = new Date().toISOString();
  const existingIndex = jobs.findIndex((j) => j.upworkJobId === payload.upworkJobId);

  const record: JobRecord = {
    id: existingIndex >= 0 ? jobs[existingIndex].id : crypto.randomUUID(),
    ...payload,
    pipelineStatus: payload.pipelineStatus || "new",
    receivedAt: now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    record.id = jobs[existingIndex].id;
    record.receivedAt = jobs[existingIndex].receivedAt;
    record.pipelineStatus =
      jobs[existingIndex].pipelineStatus ?? record.pipelineStatus;
    record.notes = jobs[existingIndex].notes;
    jobs[existingIndex] = { ...jobs[existingIndex], ...record };
    await writeJobs(jobs);
    return { job: jobs[existingIndex], created: false };
  }

  jobs.unshift(record);
  await writeJobs(jobs);
  return { job: record, created: true };
}

export async function updateJobStatus(
  upworkJobId: string,
  pipelineStatus: PipelineStatus,
  notes?: string
): Promise<JobRecord | null> {
  const jobs = await readJobs();
  const index = jobs.findIndex((j) => j.upworkJobId === upworkJobId);
  if (index < 0) return null;

  jobs[index].pipelineStatus = pipelineStatus;
  if (notes !== undefined) jobs[index].notes = notes;
  jobs[index].updatedAt = new Date().toISOString();

  await writeJobs(jobs);
  return jobs[index];
}

export async function getJobByUpworkId(upworkJobId: string): Promise<JobRecord | null> {
  const jobs = await readJobs();
  return jobs.find((j) => j.upworkJobId === upworkJobId) ?? null;
}

export function normalizeUpworkJobId(raw: string): string {
  const decoded = decodeURIComponent(raw);
  return decoded.startsWith("~") ? decoded : `~${decoded}`;
}
