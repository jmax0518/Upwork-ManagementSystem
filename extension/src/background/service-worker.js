import {
  getExtensionSettings,
  normalizeSettings,
  postJobViaFetch,
} from "../lib/apiClient.js";

const DEFAULT_SETTINGS = {
  apiBaseUrl: "http://127.0.0.1:3847",
  apiPath: "/api/jobs",
  apiKey: "",
};

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return normalizeSettings({ ...DEFAULT_SETTINGS, ...stored });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "GET_SETTINGS") return;

  getSettings().then((settings) => sendResponse({ ok: true, settings }));
  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SAVE_SETTINGS") return;

  (async () => {
    try {
      const settings = normalizeSettings(message.settings);
      await chrome.storage.sync.set(settings);
      sendResponse({ ok: true, settings });
    } catch (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    }
  })();

  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SUBMIT_JOB") return;

  (async () => {
    try {
      const settings = message.settings || (await getExtensionSettings());
      const result = await postJobViaFetch(settings, message.payload);
      sendResponse({ ok: true, result });
    } catch (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    }
  })();

  return true;
});
