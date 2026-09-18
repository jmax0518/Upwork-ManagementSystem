const DEFAULT_SETTINGS = {
  apiBaseUrl: "http://127.0.0.1:3847",
  apiPath: "/api/jobs",
  apiKey: "",
};

function extensionApi() {
  if (typeof chrome !== "undefined" && chrome.storage) return chrome;
  if (typeof browser !== "undefined" && browser.storage) return browser;
  return null;
}

function isNgrokHost(hostname) {
  return (
    hostname.endsWith(".ngrok-free.dev") ||
    hostname.endsWith(".ngrok.app") ||
    hostname.endsWith(".ngrok-free.app")
  );
}

function buildRequestHeaders(settings, requestUrl, withJsonBody) {
  const headers = { Accept: "application/json" };
  if (withJsonBody) {
    headers["Content-Type"] = "application/json";
  }
  if (settings.apiKey) {
    headers.Authorization = `Bearer ${settings.apiKey}`;
  }
  try {
    const host = new URL(requestUrl).hostname;
    if (isNgrokHost(host)) {
      headers["ngrok-skip-browser-warning"] = "true";
    }
  } catch {
    /* ignore */
  }
  return headers;
}

/** Read settings from storage (works in content scripts; no sendMessage). */
export async function getExtensionSettings() {
  const ext = extensionApi();
  if (!ext?.storage?.sync) {
    throw new Error(
      "Extension APIs unavailable. Reload the extension and refresh this Upwork tab."
    );
  }

  const stored = await ext.storage.sync.get(DEFAULT_SETTINGS);
  return normalizeSettings({ ...DEFAULT_SETTINGS, ...stored });
}

export function normalizeSettings(settings) {
  const out = { ...DEFAULT_SETTINGS, ...settings };
  if (out.apiBaseUrl === "http://localhost:3847") {
    out.apiBaseUrl = "http://127.0.0.1:3847";
  }
  return out;
}

export function buildEndpoint(settings) {
  const normalized = normalizeSettings(settings);
  const base = normalized.apiBaseUrl.replace(/\/+$/, "");
  const path = normalized.apiPath.startsWith("/")
    ? normalized.apiPath
    : `/${normalized.apiPath}`;
  return `${base}${path}`;
}

export function isLoopbackHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function wrapFetchError(err, endpoint, settings) {
  const message = err?.message || String(err);
  const base = normalizeSettings(settings).apiBaseUrl;

  if (message === "Failed to fetch") {
    if (isNgrokHost(new URL(base).hostname)) {
      return new Error(
        `Cannot reach ngrok dashboard at ${endpoint}. ` +
          "Keep web\\start-tunnel.cmd running on your PC, confirm https://yanking-bullish-negligent.ngrok-free.dev/api/health opens in ixBrowser, then reload the extension and Upwork tab."
      );
    }
    return new Error(
      `Cannot reach dashboard at ${endpoint}. Run npm run dev in web/, check Server URL in the popup, Save + Allow. Base: ${base}`
    );
  }
  return err instanceof Error ? err : new Error(message);
}

export async function ensureHostPermissionForUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error("Invalid server URL in extension settings.");
  }

  if (isLoopbackHost(url.hostname) || isNgrokHost(url.hostname)) {
    return;
  }

  const ext = extensionApi();
  const permissions = ext?.permissions;
  if (!permissions?.contains || !permissions?.request) {
    return;
  }

  const originPattern = `${url.protocol}//${url.host}/*`;
  if (await permissions.contains({ origins: [originPattern] })) {
    return;
  }

  const granted = await permissions.request({ origins: [originPattern] });
  if (!granted) {
    throw new Error(
      "Permission denied for your dashboard server. Click Save again and choose Allow."
    );
  }
}

export async function hasHostPermissionForBaseUrl(baseUrl) {
  try {
    const url = new URL(baseUrl.replace(/\/+$/, ""));
    if (isLoopbackHost(url.hostname) || isNgrokHost(url.hostname)) {
      return true;
    }
    const ext = extensionApi();
    if (!ext?.permissions?.contains) {
      return true;
    }
    const originPattern = `${url.protocol}//${url.host}/*`;
    return ext.permissions.contains({ origins: [originPattern] });
  } catch {
    return false;
  }
}

async function postJobViaFetch(settings, payload) {
  const normalized = normalizeSettings(settings);
  const endpoint = buildEndpoint(normalized);

  const allowed = await hasHostPermissionForBaseUrl(normalized.apiBaseUrl);
  if (!allowed) {
    throw new Error(
      `Extension is not allowed to call ${normalized.apiBaseUrl}. Open popup → Save settings → Allow.`
    );
  }

  const headers = buildRequestHeaders(normalized, endpoint, true);

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw wrapFetchError(err, endpoint, normalized);
  }

  let body = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    body = await response.json().catch(() => null);
  } else {
    const text = await response.text().catch(() => "");
    body = text ? { message: text.slice(0, 500) } : null;
  }

  if (!response.ok) {
    const detail =
      body?.error || body?.message || `Server responded with HTTP ${response.status}`;
    throw new Error(detail);
  }

  return { status: response.status, body };
}

/** Prefer background fetch (reliable host permissions); fallback to content-script fetch. */
export async function submitJobToServer(settings, payload) {
  const ext = extensionApi();

  if (ext?.runtime?.sendMessage && ext.runtime.id) {
    try {
      const response = await ext.runtime.sendMessage({
        type: "SUBMIT_JOB",
        settings,
        payload,
      });
      if (response?.ok) {
        return response.result;
      }
      if (response?.error) {
        throw new Error(response.error);
      }
    } catch (err) {
      const msg = err?.message || String(err);
      const retriable =
        msg.includes("Receiving end does not exist") ||
        msg.includes("Extension context invalidated") ||
        msg.includes("Could not establish connection");
      if (!retriable) {
        throw err instanceof Error ? err : new Error(msg);
      }
    }
  }

  return postJobViaFetch(settings, payload);
}

export async function testServerConnection(settings) {
  const normalized = normalizeSettings(settings);
  const base = normalized.apiBaseUrl.replace(/\/+$/, "");
  const healthUrl = `${base}/api/health`;

  await ensureHostPermissionForUrl(base);

  const headers = buildRequestHeaders(normalized, healthUrl, false);

  let response;
  try {
    response = await fetch(healthUrl, { method: "GET", headers });
  } catch (err) {
    throw wrapFetchError(err, healthUrl, normalized);
  }

  if (!response.ok) {
    if (response.status === 503) {
      throw new Error(
        `Health check failed: HTTP 503 at ${healthUrl}. ngrok tunnel may be offline—run web\\start-tunnel.cmd on your PC.`
      );
    }
    throw new Error(`Health check failed: HTTP ${response.status} (${healthUrl})`);
  }

  return response.json().catch(() => ({}));
}

export { postJobViaFetch };
