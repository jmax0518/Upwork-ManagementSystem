import {
  buildEndpoint,
  ensureHostPermissionForUrl,
  normalizeSettings,
  testServerConnection,
} from "../src/lib/apiClient.js";

const apiBaseUrl = document.getElementById("apiBaseUrl");
const apiPath = document.getElementById("apiPath");
const apiKey = document.getElementById("apiKey");
const saveBtn = document.getElementById("saveBtn");
const testBtn = document.getElementById("testBtn");
const statusEl = document.getElementById("status");

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

function currentSettings() {
  return normalizeSettings({
    apiBaseUrl: apiBaseUrl.value.trim() || "http://127.0.0.1:3847",
    apiPath: apiPath.value.trim() || "/api/jobs",
    apiKey: apiKey.value.trim(),
  });
}

async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  if (!response?.ok) return;
  const { settings } = response;
  apiBaseUrl.value = settings.apiBaseUrl || "http://127.0.0.1:3847";
  apiPath.value = settings.apiPath || "/api/jobs";
  apiKey.value = settings.apiKey || "";
}

saveBtn.addEventListener("click", async () => {
  setStatus("Saving…");
  const settings = currentSettings();

  try {
    await ensureHostPermissionForUrl(settings.apiBaseUrl.replace(/\/+$/, ""));
  } catch (err) {
    setStatus(err.message || "Could not grant host access.", true);
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "SAVE_SETTINGS",
    settings,
  });

  if (response?.ok) {
    if (response.settings?.apiBaseUrl) {
      apiBaseUrl.value = response.settings.apiBaseUrl;
    }
    setStatus("Settings saved. Host access granted for this server URL.");
  } else {
    setStatus(response?.error || "Could not save settings.", true);
  }
});

testBtn.addEventListener("click", async () => {
  setStatus("Testing connection…");
  const settings = currentSettings();

  try {
    await ensureHostPermissionForUrl(settings.apiBaseUrl.replace(/\/+$/, ""));
    await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
    await testServerConnection(settings);
    setStatus(`Connected to ${buildEndpoint(settings).replace("/api/jobs", "")}.`);
  } catch (err) {
    setStatus(err.message || "Connection failed.", true);
  }
});

loadSettings().catch((err) => setStatus(err.message, true));
