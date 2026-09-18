import Link from "next/link";
import type { JobRecord } from "@/types/job";
import { StatusBadge } from "./StatusBadge";

export function JobCard({ job }: { job: JobRecord }) {
  const title = job.job?.title || "Untitled job";
  const meta = [job.job?.type, job.job?.budget, job.job?.proposals && `${job.job.proposals} proposals`]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-teal-500/40 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/jobs/${encodeURIComponent(job.upworkJobId)}`}
            className="text-base font-semibold text-zinc-900 hover:text-teal-700 dark:text-zinc-50 dark:hover:text-teal-300"
          >
            {title}
          </Link>
          {meta ? <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{meta}</p> : null}
        </div>
        <StatusBadge status={job.pipelineStatus} />
      </div>
      {job.summary ? (
        <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          {job.summary}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{job.upworkJobId}</span>
        <span>Captured {new Date(job.capturedAt || job.receivedAt).toLocaleString()}</span>
        {job.url ? (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-teal-700 hover:underline dark:text-teal-400"
          >
            Open on Upwork
          </a>
        ) : null}
      </div>
    </article>
  );
}
