import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { getJobByUpworkId, normalizeUpworkJobId } from "@/lib/jobs";

type PageProps = {
  params: Promise<{ upworkJobId: string }>;
};

export default async function JobDetailPage({ params }: PageProps) {
  const { upworkJobId: rawId } = await params;
  const upworkJobId = normalizeUpworkJobId(rawId);
  const job = await getJobByUpworkId(upworkJobId);

  if (!job) notFound();

  const j = job.job;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-400"
      >
        ← Back to inbox
      </Link>

      <header className="space-y-3 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {j?.title || "Untitled job"}
          </h1>
          <StatusBadge status={job.pipelineStatus} />
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {[j?.type, j?.budget, j?.experienceLevel, j?.posted].filter(Boolean).join(" · ")}
        </p>
        {job.url ? (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm font-medium text-teal-700 hover:underline dark:text-teal-400"
          >
            View on Upwork
          </a>
        ) : null}
      </header>

      {job.summary ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Summary</h2>
          <pre className="whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            {job.summary}
          </pre>
        </section>
      ) : null}

      {j?.description ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Description
          </h2>
          <div className="whitespace-pre-wrap rounded-xl border border-zinc-200 p-4 text-sm leading-relaxed text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
            {j.description}
          </div>
        </section>
      ) : null}

      {j?.skills && j.skills.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {j.skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {skill}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {job.client?.summaryLine ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Client</h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{job.client.summaryLine}</p>
        </section>
      ) : null}

      {j?.screeningQuestions && j.screeningQuestions.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Screening questions
          </h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {j.screeningQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
