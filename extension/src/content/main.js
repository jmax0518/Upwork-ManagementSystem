import { getExtensionSettings, submitJobToServer } from "../lib/apiClient.js";
import { extractCurrentJob } from "../lib/extractJob.js";
import { buildJobPayload } from "../lib/payload.js";

const LOG_PREFIX = "[Upwork Summarizer]";
const FAB_ID = "ujs-summary-fab";
const INLINE_ID = "ujs-summary-inline";

function log(...args) {
  console.log(LOG_PREFIX, ...args);
}

function showToast(message, type = "info") {
  let toast = document.getElementById("ujs-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "ujs-toast";
    toast.className = "ujs-toast";
    document.body.appendChild(toast);
  }
  toast.dataset.type = type;
  toast.textContent = message;
  toast.classList.add("ujs-toast-visible");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove("ujs-toast-visible");
  }, 4500);
}

function createSummaryButton({ id, className, label = "Summary" }) {
  const btn = document.createElement("button");
  btn.id = id;
  btn.type = "button";
  btn.className = className;
  btn.title = "Summarize job and send to dashboard";
  btn.innerHTML = `<span class="ujs-summary-fab-label">${label}</span>`;
  btn.addEventListener("click", onSummaryClick);
  return btn;
}

function findJobActionsContainer() {
  const triggers = [
    /save job/i,
    /buy connects to apply/i,
    /^apply now$/i,
    /submit a proposal/i,
    /apply for/i,
  ];

  for (const el of document.querySelectorAll("button, a")) {
    const text = el.textContent.replace(/\s+/g, " ").trim();
    if (!text || text.length > 80) continue;
    if (triggers.some((re) => re.test(text))) {
      return el.closest('[class*="actions"], [class*="sidebar"], section, div') || el.parentElement;
    }
  }
  return null;
}

function ensureFabButton() {
  if (document.getElementById(FAB_ID)) return;
  if (!document.body) return;

  const btn = createSummaryButton({
    id: FAB_ID,
    className: "ujs-summary-fab",
  });
  document.body.appendChild(btn);
  log("Floating Summary button ready");
}

function ensureInlineButton() {
  if (document.getElementById(INLINE_ID)) return;

  const container = findJobActionsContainer();
  if (!container) return;

  const btn = createSummaryButton({
    id: INLINE_ID,
    className: "ujs-summary-inline",
  });

  const saveBtn = [...container.querySelectorAll("button, a")].find((el) =>
    /save job/i.test(el.textContent)
  );
  if (saveBtn?.parentElement) {
    saveBtn.parentElement.insertBefore(btn, saveBtn.nextSibling);
  } else {
    container.appendChild(btn);
  }

  log("Inline Summary button added near job actions");
}

async function onSummaryClick() {
  for (const id of [FAB_ID, INLINE_ID]) {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = true;
      el.classList.add("ujs-summary-fab-loading");
    }
  }

  try {
    const extracted = extractCurrentJob();
    if (!extracted.ok) {
      showToast(extracted.error, "error");
      return;
    }

    const payload = buildJobPayload(extracted);
    showToast("Sending to your server…", "info");

    const settings = await getExtensionSettings();
    await submitJobToServer(settings, payload);

    showToast("Job summarized and saved to server.", "success");
    log("Submitted job", payload.upworkJobId);
  } catch (err) {
    console.error(LOG_PREFIX, err);
    showToast(err.message || "Unexpected error.", "error");
  } finally {
    for (const id of [FAB_ID, INLINE_ID]) {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = false;
        el.classList.remove("ujs-summary-fab-loading");
      }
    }
  }
}

function ensureUi() {
  ensureFabButton();
  ensureInlineButton();
}

function init() {
  log("Content script loaded on", window.location.href);
  ensureUi();
  setInterval(ensureUi, 1500);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
