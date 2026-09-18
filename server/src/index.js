import cors from "cors";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");

const PORT = Number(process.env.PORT || 3847);
const API_KEY = process.env.API_KEY || "";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

async function readJobs() {
  try {
    const raw = await fs.readFile(JOBS_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeJobs(jobs) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(JOBS_FILE, JSON.stringify(jobs, null, 2), "utf8");
}

function authMiddleware(req, res, next) {
  if (!API_KEY) return next();
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "upwork-management-api" });
});

app.get("/api/jobs", authMiddleware, async (_req, res) => {
  const jobs = await readJobs();
  res.json({ jobs });
});

app.post("/api/jobs", authMiddleware, async (req, res) => {
  const payload = req.body;
  if (!payload?.upworkJobId) {
    return res.status(400).json({ error: "Missing upworkJobId" });
  }

  const jobs = await readJobs();
  const now = new Date().toISOString();
  const existingIndex = jobs.findIndex((j) => j.upworkJobId === payload.upworkJobId);

  const record = {
    id: existingIndex >= 0 ? jobs[existingIndex].id : crypto.randomUUID(),
    ...payload,
    pipelineStatus: payload.pipelineStatus || "new",
    receivedAt: now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    record.id = jobs[existingIndex].id;
    record.receivedAt = jobs[existingIndex].receivedAt;
    record.pipelineStatus = jobs[existingIndex].pipelineStatus ?? record.pipelineStatus;
    jobs[existingIndex] = { ...jobs[existingIndex], ...record };
  } else {
    jobs.unshift(record);
  }

  await writeJobs(jobs);
  res.status(existingIndex >= 0 ? 200 : 201).json({ ok: true, job: record });
});

app.patch("/api/jobs/:upworkJobId/status", authMiddleware, async (req, res) => {
  const id = decodeURIComponent(req.params.upworkJobId);
  const { pipelineStatus, notes } = req.body || {};
  if (!pipelineStatus) {
    return res.status(400).json({ error: "pipelineStatus is required" });
  }

  const jobs = await readJobs();
  const index = jobs.findIndex((j) => j.upworkJobId === id);
  if (index < 0) {
    return res.status(404).json({ error: "Job not found" });
  }

  jobs[index].pipelineStatus = pipelineStatus;
  if (notes !== undefined) jobs[index].notes = notes;
  jobs[index].updatedAt = new Date().toISOString();

  await writeJobs(jobs);
  res.json({ ok: true, job: jobs[index] });
});

app.listen(PORT, () => {
  console.log(`Upwork management API listening on http://localhost:${PORT}`);
});
