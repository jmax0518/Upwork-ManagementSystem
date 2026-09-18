import { JobCard } from "@/components/JobCard";
import { readJobs } from "@/lib/jobs";

export default async function HomePage() {
  const jobs = await readJobs();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">
          Upwork Management
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Job inbox
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Jobs captured from the Chrome extension appear here. Use the extension{" "}
          <strong>Summary</strong> button on Upwork while this app runs at{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-900">
            http://127.0.0.1:3847
          </code>
          .
        </p>
      </header>

      <section className="grid gap-3">
        {jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No jobs yet. Capture one from Upwork with the extension.
            </p>
          </div>
        ) : (
          jobs.map((job) => <JobCard key={job.id} job={job} />)
        )}
      </section>
    </div>
  );
}
