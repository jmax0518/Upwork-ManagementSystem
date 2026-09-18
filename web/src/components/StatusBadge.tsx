import type { PipelineStatus } from "@/types/job";

const LABELS: Record<PipelineStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  bid_planned: "Bid planned",
  bid_sent: "Bid sent",
  interview: "Interview",
  won: "Won",
  lost: "Lost",
  passed: "Passed",
};

const STYLES: Record<PipelineStatus, string> = {
  new: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  reviewing: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  bid_planned: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  bid_sent: "bg-teal-500/15 text-teal-800 dark:text-teal-200",
  interview: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  won: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  lost: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  passed: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",
};

export function StatusBadge({ status }: { status: PipelineStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
