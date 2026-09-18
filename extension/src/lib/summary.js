function firstSentences(text, maxChars = 320) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxChars) return normalized;

  const slice = normalized.slice(0, maxChars);
  const lastPeriod = slice.lastIndexOf(". ");
  if (lastPeriod > 80) return slice.slice(0, lastPeriod + 1);
  return `${slice.trim()}…`;
}

function skillPreview(skills, limit = 8) {
  if (!skills?.length) return "";
  const head = skills.slice(0, limit).join(", ");
  if (skills.length > limit) return `${head}, +${skills.length - limit} more`;
  return head;
}

/**
 * Builds a concise summary for quick scanning in your dashboard.
 * Your server can replace or augment this with LLM summarization later.
 */
export function buildJobSummary({ job, upworkJobId }) {
  const lines = [];

  lines.push(job.title);

  const meta = [
    job.type,
    job.budget,
    job.experience,
    job.hours,
    job.duration,
    job.posted,
  ].filter(Boolean);
  if (meta.length) lines.push(meta.join(" · "));

  if (job.proposals) lines.push(`Proposals: ${job.proposals}`);
  if (job.connects != null) lines.push(`Connects required: ${job.connects}`);

  const skills = skillPreview(job.skills);
  if (skills) lines.push(`Skills: ${skills}`);

  if (job.client?.summaryLine) {
    lines.push(`Client: ${job.client.summaryLine}`);
  }

  const blurb = firstSentences(job.description);
  if (blurb) {
    lines.push("");
    lines.push(blurb);
  }

  if (job.screeningQuestions?.length) {
    lines.push("");
    lines.push(
      `${job.screeningQuestions.length} screening question(s): ${job.screeningQuestions[0].slice(0, 120)}${job.screeningQuestions[0].length > 120 ? "…" : ""}`
    );
  }

  lines.push("");
  lines.push(`Upwork ID: ~${upworkJobId}`);

  return lines.join("\n").trim();
}
