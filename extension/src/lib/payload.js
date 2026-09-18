import { buildJobSummary } from "./summary.js";

const EXTENSION_VERSION = "1.0.0";

export function buildJobPayload({ upworkJobId, job }) {
  const capturedAt = new Date().toISOString();

  return {
    source: "upwork-job-summarizer-extension",
    extensionVersion: EXTENSION_VERSION,
    capturedAt,
    upworkJobId: `~${upworkJobId}`,
    url: job.url || null,
    pipelineStatus: "new",
    summary: buildJobSummary({ job, upworkJobId }),
    job: {
      title: job.title,
      description: job.description,
      type: job.type || null,
      budget: job.budget || null,
      bids: job.bids || null,
      contractToHire: job.contractToHire,
      experienceLevel: job.experience || null,
      duration: job.duration || null,
      workload: job.hours || null,
      projectType: job.projectType || null,
      posted: job.posted || null,
      skills: job.skills,
      connectsRequired: job.connects,
      proposals: job.proposals || null,
      activity: job.activity,
      screeningQuestions: job.screeningQuestions,
      qualifications: job.qualifications,
    },
    client: job.client,
  };
}
